import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

type Answer = { id: string; questionId: string; tutorId: string; body: string; upvotes: number; accepted: boolean; createdAt: string; tutorName: string };
type Question = { id: string; authorId: string; subject: string; title: string; body: string; imageUrl: string | null; status: string; createdAt: string; answers: Answer[] };

export default function CommunityQuestionDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, request } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    void request<Question>(`/marketplace/community/questions/${id}`)
      .then((q) => setQuestion(q))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load question.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const postAnswer = async () => {
    if (!answerText.trim()) return;
    setPosting(true);
    setError('');
    try {
      await request(`/marketplace/community/questions/${id}/answers`, { method: 'POST', body: { body: answerText.trim() } });
      setAnswerText('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post answer.');
    } finally {
      setPosting(false);
    }
  };

  const upvote = async (answerId: string) => {
    try { await request(`/marketplace/community/answers/${answerId}/upvote`, { method: 'POST' }); load(); } catch {}
  };

  if (loading) return <Screen><PageHeader title="Question" onBack={() => router.back()} /><Text style={{ color: colors.mutedForeground, padding: 20 }}>Loading…</Text></Screen>;
  if (!question) return <Screen><PageHeader title="Not found" onBack={() => router.back()} /><EmptyState icon="help-circle-outline" title="Question not found" description={error} /></Screen>;

  const isAuthor = user?.id === question.authorId;
  const isTutor = user?.activeRole === 'tutor';

  return (
    <Screen>
      <PageHeader title={question.title} onBack={() => router.back()} />
      <View style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.subjectBadge, { backgroundColor: colors.leaf }]}>
          <Text style={[styles.subjectText, { color: colors.primary }]}>{question.subject}</Text>
        </View>
        <Text style={[styles.qBody, { color: colors.foreground }]}>{question.body}</Text>
        <Text style={[styles.qMeta, { color: colors.mutedForeground }]}>Asked {new Date(question.createdAt).toLocaleDateString()}</Text>
      </View>

      <SectionHeading title={`Answers (${question.answers.length})`} />
      {question.answers.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" title="No answers yet" description="Be the first to help." />
      ) : null}
      {question.answers.map((a) => (
        <View key={a.id} style={[styles.answerCard, { backgroundColor: colors.card, borderColor: a.accepted ? colors.primary : colors.border }]}>
          <View style={styles.answerHeader}>
            <Text style={[styles.tutorName, { color: colors.foreground }]}>{a.tutorName}</Text>
            {a.accepted ? <View style={[styles.acceptedBadge, { backgroundColor: colors.leaf }]}><Ionicons name="checkmark-circle" size={12} color={colors.primary} /><Text style={[styles.acceptedText, { color: colors.primary }]}>Accepted</Text></View> : null}
          </View>
          <Text style={[styles.answerBody, { color: colors.foreground }]}>{a.body}</Text>
          <View style={styles.answerFooter}>
            <HapticPressable onPress={() => void upvote(a.id)} style={styles.upvoteBtn}>
              <Ionicons name="arrow-up" size={14} color={colors.primary} />
              <Text style={[styles.upvoteText, { color: colors.primary }]}>{a.upvotes}</Text>
            </HapticPressable>
            {isAuthor && !a.accepted ? (
              <HapticPressable onPress={() => void request(`/marketplace/community/answers/${a.id}/accept`, { method: 'POST' }).then(() => load())} style={[styles.acceptBtn, { backgroundColor: colors.leaf }]}>
                <Text style={[styles.acceptBtnText, { color: colors.primary }]}>Accept</Text>
              </HapticPressable>
            ) : null}
          </View>
        </View>
      ))}

      {isTutor ? (
        <View style={[styles.answerForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput value={answerText} onChangeText={setAnswerText} placeholder="Write your answer…" multiline numberOfLines={4} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <ActionButton label={posting ? 'Posting…' : 'Post answer'} onPress={() => void postAnswer()} disabled={posting || !answerText.trim()} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qCard: { borderRadius: 16, borderWidth: 1, gap: 6, marginBottom: 12, padding: 14 },
  subjectBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  subjectText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  qBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  qMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 6 },
  answerCard: { borderRadius: 16, borderWidth: 1, gap: 6, marginBottom: 10, padding: 14 },
  answerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tutorName: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  acceptedBadge: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
  acceptedText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  answerBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 4 },
  answerFooter: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 6 },
  upvoteBtn: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  upvoteText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  acceptBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  acceptBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  answerForm: { borderRadius: 16, borderWidth: 1, gap: 8, marginTop: 12, padding: 14 },
  input: { borderRadius: 12, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});