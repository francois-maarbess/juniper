import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HapticPressable } from '@/components/HapticPressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Booking = {
  id: string;
  paymentMethodAgreed: 'cash' | 'whish' | 'omt' | null;
  paymentStatus: 'pending' | 'reported_paid_by_learner' | 'confirmed_by_tutor';
};

export function TutorEarningsTracker() {
  const colors = useColors();
  const router = useRouter();
  const { request } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void request<Booking[]>('/marketplace/bookings')
      .then((result) => { if (active) setBookings(result); })
      .catch(() => { if (active) setBookings([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);

  const counts = useMemo(() => ({
    pending: bookings.filter((booking) =>
      booking.paymentStatus === 'pending' && (booking.paymentMethodAgreed === 'whish' || booking.paymentMethodAgreed === 'omt'),
    ).length,
    unconfirmed: bookings.filter((booking) => booking.paymentStatus === 'reported_paid_by_learner').length,
  }), [bookings]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.leaf }]}>
          <Ionicons name="wallet-outline" size={19} color={colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>TUTOR STUDIO</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Payment follow-up</Text>
        </View>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
      </View>

      <View style={styles.metrics}>
        <Metric
          label="Pending Payments"
          description="Awaiting learner transfer via Whish or OMT"
          value={counts.pending}
          loading={loading}
          colors={colors}
          icon="time-outline"
        />
        <Metric
          label="Unconfirmed Receipts"
          description="Marked paid, waiting for your approval"
          value={counts.unconfirmed}
          loading={loading}
          colors={colors}
          icon="receipt-outline"
          emphasis={counts.unconfirmed > 0}
        />
      </View>

      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Review pending transfers"
        onPress={() => router.push('/(tabs)/activity')}
        style={({ pressed }: { pressed: boolean }) => [
          styles.action,
          { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
        ]}
      >
        <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Review Pending Transfers</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.primaryForeground} />
      </HapticPressable>
    </View>
  );
}

function Metric({
  label, description, value, loading, colors, icon, emphasis = false,
}: {
  label: string;
  description: string;
  value: number;
  loading: boolean;
  colors: ReturnType<typeof useColors>;
  icon: keyof typeof Ionicons.glyphMap;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: emphasis ? colors.pale : colors.background }]}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={16} color={emphasis ? colors.orange : colors.primary} />
        <Text style={[styles.value, { color: colors.foreground }]}>{loading ? '—' : value}</Text>
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, gap: 16, marginTop: 16, padding: 16, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  icon: { alignItems: 'center', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  headingCopy: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { borderRadius: 16, flex: 1, gap: 5, minHeight: 116, padding: 12 },
  metricTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 11, lineHeight: 15 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  action: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', minHeight: 46, paddingHorizontal: 14, gap: 8 },
  actionText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
