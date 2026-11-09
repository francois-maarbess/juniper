import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';
import { useJuniper } from '@/context/JuniperContext';
import { ActionButton, PageHeader, Screen, StatusPill, TutorPortrait } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';

export default function ConfirmationScreen() {
  const colors = useColors();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { state } = useJuniper();
  const booking = state.bookings.find((item) => item.id === bookingId);
  const tutor = booking ? SAMPLE_TUTORS.find((item) => item.id === booking.tutorId) : undefined;

  useEffect(() => {
    if (!__DEV__) router.replace('/(tabs)/activity');
  }, [router]);

  if (!__DEV__) return null;

  if (!booking || !tutor) {
    return (
      <Screen>
        <PageHeader title="Workroom unavailable" onBack={() => router.back()} />
        <ActionButton label="Back to my learning" onPress={() => router.replace('/(tabs)/activity')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={[styles.successIcon, { backgroundColor: colors.leaf }]}>
          <Ionicons name="checkmark-done" size={29} color={colors.primary} />
        </View>
        <StatusPill label="Session arranged" tone="green" />
        <Text style={[styles.title, { color: colors.foreground }]}>You’re ready to learn together</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Use your session space to message, prepare questions, and share learning materials. Agree on payment directly with your tutor.
        </Text>
      </View>
      <View style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TutorPortrait tutor={tutor} size="small" />
        <View style={styles.sessionCopy}>
          <Text style={[styles.sessionName, { color: colors.foreground }]}>{tutor.name}</Text>
          <Text style={[styles.sessionSubject, { color: colors.mutedForeground }]}>{booking.subject}</Text>
          <Text style={[styles.sessionSlot, { color: colors.primary }]}>{booking.slot}</Text>
        </View>
        <Text style={[styles.price, { color: colors.foreground }]}>Agreed · ${booking.price}</Text>
      </View>
      <View style={[styles.prepCard, { backgroundColor: colors.pale }]}>
        <Text style={[styles.prepTitle, { color: colors.foreground }]}>Before your session</Text>
        <View style={styles.prepLine}>
          <Ionicons name="cloud-upload-outline" size={17} color={colors.primary} />
          <Text style={[styles.prepText, { color: colors.foreground }]}>Add a question or topic you’d like to cover. Share only materials you’re allowed to share.</Text>
        </View>
        <View style={styles.prepLine}>
          <Ionicons name="cash-outline" size={17} color={colors.primary} />
          <Text style={[styles.prepText, { color: colors.foreground }]}>Confirm the session time, price, and payment method with your tutor.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton
          label="Open session"
          icon="arrow-forward"
          onPress={() => router.push(`/workroom/${booking.id}` as never)}
        />
        <ActionButton
          label="View my learning"
          variant="quiet"
          onPress={() => router.replace('/(tabs)/activity')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16 },
  successIcon: { alignItems: 'center', borderRadius: 28, height: 72, justifyContent: 'center', marginBottom: 6, width: 72, shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -1.0, lineHeight: 36, marginTop: 6, textAlign: 'center' },
  description: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, maxWidth: 300, textAlign: 'center' },
  sessionCard: { alignItems: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 14, padding: 16, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sessionCopy: { flex: 1, gap: 4 },
  sessionName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  sessionSubject: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sessionSlot: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  prepCard: { borderRadius: 22, gap: 14, marginTop: 18, padding: 18, shadowColor: '#183B31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  prepTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2, marginBottom: 2 },
  prepLine: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  prepText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
  actions: { gap: 8, marginTop: 24 },
});
