import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

type Question = {
  id: string; authorId: string; subject: string; title: string; body: string; imageUrl: string | null;
  status: string; createdAt: string; authorName: string; answerCount: number;
};

export default function CommunityScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, request } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [qSubject, setQSubject] = useState('Mathematics');
  const [qTitle, setQTitle] = useState('');
  const [qBody, setQBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    const q = subject !== 'All' ? `?subject=${encodeURIComponent(subject)}` : '';
    void request<Question[]>(`/marketplace/community/questions${q}`)
      .then((rows) => setQuestions(rows || []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [subject]);

  const postQuestion = async () => {
    if (!qTitle.trim() || !qBody.trim()) { setError('Title and body are required.'); return; }
    setPosting(true);
    setError('');
    try {
      await request('/marketplace/community/questions', { method: 'POST', body: { subject: qSubject, title: qTitle.trim(), body: qBody.trim() } });
      setQTitle(''); setQBody(''); setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post question.');
    } finally {
      setPosting(false);
    }
  };

  const subjects = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'Writing', 'Biology'];

  return (
    <Screen>
      <PageHeader title="Community Q&A" eyebrow="Ask, answer, learn" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {subjects.map((s) => (
          <HapticPressable key={s} onPress={() => setSubject(s)} style={[styles.pill, { backgroundColor: subject === s ? colors.primary : colors.card, borderColor: subject === s ? colors.primary : colors.border }]}>
            <Text style={[styles.pillText, { color: subject === s ? colors.primaryForeground : colors.foreground }]}>{s}</Text>
          </HapticPressable>
        ))}
      </ScrollView>

      {user ? (
        <HapticPressable onPress={() => setShowForm(!showForm)} style={[styles.askBtn, { backgroundColor: colors.leaf }]}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.askText, { color: colors.primary }]}>{showForm ? 'Cancel' : 'Ask a question'}</Text>
        </HapticPressable>
      ) : null}

      {showForm ? (
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
            {subjects.filter((s) => s !== 'All').map((s) => (
              <HapticPressable key={s} onPress={() => setQSubject(s)} style={[styles.pill, { backgroundColor: qSubject === s ? colors.primary : colors.card, borderColor: qSubject === s ? colors.primary : colors.border }]}>
                <Text style={[styles.pillText, { color: qSubject === s ? colors.primaryForeground : colors.foreground }]}>{s}</Text>
              </HapticPressable>
            ))}
          </ScrollView>
          <TextInput value={qTitle} onChangeText={setQTitle} placeholder="Question title" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
          <TextInput value={qBody} onChangeText={setQBody} placeholder="Describe your question in detail…" multiline numberOfLines={4} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <ActionButton label={posting ? 'Posting…' : 'Post question'} onPress={() => void postQuestion()} disabled={posting} />
        </View>
      ) : null}

      {loading ? <Text style={{ color: colors.mutedForeground, padding: 20 }}>Loading questions…</Text> : null}
      {!loading && questions.length === 0 ? (
        <EmptyState icon="help-circle-outline" title="No questions yet" description="Be the first to ask the community." />
      ) : null}
      {questions.map((q) => (
        <HapticPressable key={q.id} onPress={() => router.push(`/community/${q.id}` as never)} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.qTop}>
            <View style={[styles.subjectBadge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.subjectText, { color: colors.primary }]}>{q.subject}</Text>
            </View>
            <Text style={[styles.answerCount, { color: colors.mutedForeground }]}>{q.answerCount} {q.answerCount === 1 ? 'answer' : 'answers'}</Text>
          </View>
          <Text style={[styles.qTitle, { color: colors.foreground }]}>{q.title}</Text>
          <Text numberOfLines={2} style={[styles.qBody, { color: colors.mutedForeground }]}>{q.body}</Text>
          <Text style={[styles.qMeta, { color: colors.mutedForeground }]}>by {q.authorName} · {new Date(q.createdAt).toLocaleDateString()}</Text>
        </HapticPressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  askBtn: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, marginBottom: 12, paddingVertical: 10, justifyContent: 'center' },
  askText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  form: { borderRadius: 16, borderWidth: 1, gap: 8, marginBottom: 12, padding: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  input: { borderRadius: 12, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  qCard: { borderRadius: 16, borderWidth: 1, gap: 4, marginBottom: 10, padding: 14 },
  qTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  subjectBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  subjectText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  answerCount: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  qTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 4 },
  qBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  qMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 6 },
});