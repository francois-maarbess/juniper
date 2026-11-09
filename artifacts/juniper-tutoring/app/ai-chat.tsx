import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Image, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, EmptyState, PageHeader, Screen } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';
import Markdown from 'react-native-markdown-display';

type AiMsg = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
type Conversation = { id: string; title: string; bookingId: string | null; createdAt: string; updatedAt: string };

const SUGGESTED_PROMPTS = [
  'Explain this like I\'m 15',
  'Give me 3 practice problems',
  'Quiz me on this topic',
  'Break this into smaller steps',
];

export default function AiChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, request, upload } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await request<Conversation[]>('/api/ai/conversations');
      setConversations(rows || []);
    } catch {
      setConversations([]);
    }
  }, [user, request]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await request<{ messages: AiMsg[] }>(`/api/ai/conversations/${id}`);
      setMessages(conv.messages || []);
      setActiveConvId(id);
    } catch {
      setMessages([]);
    }
  }, [request]);

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setDraft('');
    setImageUri(null);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  };

  const send = async (text?: string) => {
    const msg = (text || draft).trim();
    if (!msg && !imageUri) return;
    setSending(true);
    Keyboard.dismiss();
    try {
      if (imageUri) {
        const form = new FormData();
        if (Platform.OS === 'web') {
          const r = await fetch(imageUri);
          const blob = await r.blob();
          form.append('image', blob, 'problem.jpg');
        } else {
          form.append('image', { uri: imageUri, name: 'problem.jpg', type: 'image/jpeg' } as any);
        }
        form.append('text', msg || 'Explain this problem');
        form.append('subject', subject);
        const res = await upload<{ conversationId: string; message: AiMsg }>('/api/ai/explain', form);
        if (res.conversationId) {
          setActiveConvId(res.conversationId);
          await loadConversation(res.conversationId);
        }
        setImageUri(null);
      } else {
        const res = await request<{ conversationId: string; message: AiMsg }>('/api/ai/chat', {
          method: 'POST',
          body: { conversationId: activeConvId, message: msg, subject },
        });
        setActiveConvId(res.conversationId);
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: msg, createdAt: new Date().toISOString() },
          res.message,
        ]);
      }
      setDraft('');
      await loadConversations();
    } catch (e) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <PageHeader title="AI Study Companion" onBack={() => router.back()} />
        <EmptyState icon="sparkles-outline" title="Sign in to use AI" description="Your personal study companion is waiting." action="Sign in" onAction={() => router.push('/(auth)/welcome' as never)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <PageHeader title="AI Study Companion" onBack={() => router.back()} />
      <View style={styles.subjectRow}>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Subject (e.g. Calculus)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.subjectInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        <HapticPressable onPress={newConversation} style={[styles.newBtn, { backgroundColor: colors.leaf }]}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </HapticPressable>
      </View>

      {conversations.length > 0 && !activeConvId ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Recent conversations</Text>
          {conversations.map((c) => (
            <HapticPressable key={c.id} onPress={() => void loadConversation(c.id)} style={[styles.convCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
              <Text style={[styles.convTitle, { color: colors.foreground }]}>{c.title}</Text>
            </HapticPressable>
          ))}
        </ScrollView>
      ) : (
        <>
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ gap: 10, padding: 16 }}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: colors.primary } : { alignSelf: 'flex-start', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <Markdown style={{ body: { color: item.role === 'user' ? colors.primaryForeground : colors.foreground, fontSize: 14 } }}>
                  {item.content}
                </Markdown>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={40} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ask me anything</Text>
                <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>I'll guide you step by step — never just give the answer.</Text>
                <View style={styles.promptRow}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <HapticPressable key={p} onPress={() => void send(p)} style={[styles.promptChip, { backgroundColor: colors.leaf }]}>
                      <Text style={[styles.promptText, { color: colors.primary }]}>{p}</Text>
                    </HapticPressable>
                  ))}
                </View>
              </View>
            }
          />
          {imageUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} />
              <HapticPressable onPress={() => setImageUri(null)} style={styles.removeImg}>
                <Ionicons name="close-circle" size={20} color={colors.destructive} />
              </HapticPressable>
            </View>
          ) : null}
          <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <HapticPressable onPress={pickImage} style={styles.iconBtn}>
              <Ionicons name="image-outline" size={20} color={colors.primary} />
            </HapticPressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask a question…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, { color: colors.foreground }]}
            />
            <HapticPressable
              onPress={() => void send()}
              disabled={sending || (!draft.trim() && !imageUri)}
              style={[styles.sendBtn, { backgroundColor: sending ? colors.muted : colors.primary, opacity: (!draft.trim() && !imageUri) ? 0.5 : 1 }]}
            >
              <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
            </HapticPressable>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subjectRow: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 16 },
  subjectInput: { borderRadius: 12, borderWidth: 1, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  newBtn: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', width: 44 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, marginBottom: 8 },
  convCard: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 14 },
  convTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  bubble: { borderRadius: 16, maxWidth: '85%', padding: 12 },
  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 },
  promptChip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  promptText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  imagePreview: { marginHorizontal: 16, marginBottom: 8, position: 'relative' },
  previewImg: { borderRadius: 12, height: 120, width: 120 },
  removeImg: { position: 'absolute', right: -6, top: -6 },
  composer: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { alignItems: 'center', justifyContent: 'center', width: 36 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, maxHeight: 100, paddingHorizontal: 4, paddingVertical: 8 },
  sendBtn: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
});
