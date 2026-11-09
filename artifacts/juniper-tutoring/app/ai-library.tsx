import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

export default function AiLibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, request } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void request<any[]>('/api/ai/conversations')
      .then((rows) => { if (active) setConversations(rows || []); })
      .catch(() => { if (active) setConversations([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, request]);

  if (!user) {
    return (
      <Screen>
        <PageHeader title="Study Library" onBack={() => router.back()} />
        <EmptyState icon="library-outline" title="Sign in" description="Your saved study guides will appear here." action="Sign in" onAction={() => router.push('/(auth)/welcome' as never)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Study Library" onBack={() => router.back()} />
      {loading ? <Text style={{ color: colors.mutedForeground, padding: 20 }}>Loading…</Text> : null}
      {!loading && conversations.length === 0 ? (
        <EmptyState icon="library-outline" title="No saved guides yet" description="Generate a study guide from a workroom session to save it here." />
      ) : null}
      <ScrollView contentContainerStyle={{ gap: 10, padding: 16 }}>
        {conversations.map((c) => (
          <HapticPressable
            key={c.id}
            onPress={() => router.push(`/ai-chat` as never)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>{c.title}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{new Date(c.updatedAt).toLocaleDateString()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </HapticPressable>
        ))}
      </ScrollView>
      <View style={{ padding: 16 }}>
        <ActionButton label="Open AI Companion" icon="sparkles-outline" onPress={() => router.push('/ai-chat' as never)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
});