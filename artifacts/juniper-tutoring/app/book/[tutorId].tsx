import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';
import { hapticMedium } from '@/lib/haptics';

type Slot = {
  id: string;
  tutorId: string;
  startAt: string;
  endAt: string;
  priceCents: number;
  status: string;
};

export default function BookTutorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { tutorId, tutorName, subject } = useLocalSearchParams<{ tutorId: string; tutorName?: string; subject?: string }>();
  const { user, request } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tutorId) return;
    let active = true;
    setLoading(true);
    void request<Slot[]>(`/marketplace/tutors/${tutorId}/slots`)
      .then((rows) => { if (active) setSlots(rows); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load slots.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tutorId, request]);

  const askAboutSlot = (slot: Slot) => {
    if (!user) { router.push('/(auth)/welcome' as never); return; }
    const requestedTime = new Date(slot.startAt).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    hapticMedium();
    router.push({ pathname: '/request', params: {
      tutorId, tutorName: tutorName || 'this tutor', subject: subject || '', requestedTime,
    } } as never);
  };

  // Group slots by date
  const grouped: Record<string, Slot[]> = {};
  for (const s of slots) {
    const d = new Date(s.startAt).toLocaleDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(s);
  }

  if (!user) {
    return (
      <Screen>
        <PageHeader title="Ask about a time" onBack={() => router.back()} />
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.mutedForeground }}>Sign in to book a session.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Ask about a time" eyebrow={tutorName ? `With ${tutorName}` : 'Tutor availability'} onBack={() => router.back()} />
      <View style={[styles.explainer, { backgroundColor: colors.pale }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.explainerText, { color: colors.foreground }]}>These times are listed by the tutor. Choose one to request it; the tutor will confirm before a session is arranged.</Text>
      </View>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.loading, { color: colors.mutedForeground }]}>Loading available slots…</Text> : null}
      {!loading && slots.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No times are listed right now. Send a request and agree on a time with the tutor.</Text>
        </View>
      ) : null}
      {Object.entries(grouped).map(([date, daySlots]) => (
        <View key={date} style={styles.dayGroup}>
          <Text style={[styles.dayLabel, { color: colors.foreground }]}>{date}</Text>
          <View style={styles.slotGrid}>
            {daySlots.map((slot) => {
              return (
                <HapticPressable
                  key={slot.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask about ${new Date(slot.startAt).toLocaleString()}`}
                  onPress={() => askAboutSlot(slot)}
                  style={[
                    styles.slot,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.slotTime, { color: colors.primary }]}>
                    {new Date(slot.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.slotPrice, { color: colors.mutedForeground }]}>
                    ${(slot.priceCents / 100).toFixed(0)} / hour
                  </Text>
                  <Text style={[styles.slotPrice, { color: colors.primary }]}>Ask about this time</Text>
                </HapticPressable>
              );
            })}
          </View>
        </View>
      ))}
      <SectionHeading title="Need a different time?" />
      <ActionButton label="Ask this tutor about another time" icon="chatbubble-ellipses-outline" variant="secondary" onPress={() => router.push({ pathname: '/request', params: { tutorId, tutorName: tutorName || 'this tutor', subject: subject || '' } } as never)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8, paddingHorizontal: 20 },
  explainer: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 9, marginBottom: 12, padding: 12 },
  explainerText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  loading: { fontFamily: 'Inter_400Regular', fontSize: 13, padding: 20 },
  empty: { alignItems: 'center', gap: 10, padding: 40 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  dayGroup: { marginBottom: 16, paddingHorizontal: 20 },
  dayLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 8 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, minWidth: 80 },
  slotTime: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  slotPrice: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 2 },
});
