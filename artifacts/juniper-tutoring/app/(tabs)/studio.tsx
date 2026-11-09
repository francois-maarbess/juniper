import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

export default function StudioScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, request } = useAuth();
  const [earnings, setEarnings] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      request<any>('/marketplace/business/earnings').catch(() => null),
      request<any[]>('/marketplace/business/students').catch(() => []),
      request<any[]>('/marketplace/business/invoices').catch(() => []),
      request<any[]>('/marketplace/business/calendar').catch(() => []),
    ]).then(([e, s, inv, ev]) => {
      if (!active) return;
      setEarnings(e);
      setStudents(s || []);
      setInvoices(inv || []);
      setEvents(ev || []);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, request]);

  if (!user) {
    return (
      <Screen>
        <PageHeader title="Studio" onBack={() => router.back()} />
        <EmptyState icon="briefcase-outline" title="Sign in as a tutor" description="Your business dashboard lives here." action="Sign in" onAction={() => router.push('/(auth)/welcome' as never)} />
      </Screen>
    );
  }

  const e = earnings || {};

  return (
    <Screen>
      <PageHeader title="Tutor Studio" eyebrow="Your teaching business" />

      {/* Earnings KPIs */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Total earned</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>${((e.totalEarnedCents || 0) / 100).toFixed(0)}</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Pending</Text>
          <Text style={[styles.kpiValue, { color: colors.foreground }]}>${((e.pendingAmountCents || 0) / 100).toFixed(0)}</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          <Text style={[styles.kpiValue, { color: colors.foreground }]}>{e.completedSessions || 0}</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Vault sales</Text>
          <Text style={[styles.kpiValue, { color: colors.foreground }]}>{e.vaultSales || 0}</Text>
        </View>
      </View>

      {/* Vault revenue */}
      <View style={[styles.card, { backgroundColor: colors.leaf }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Vault Revenue</Text>
        <Text style={[styles.cardValue, { color: colors.foreground }]}>${((e.vaultRevenueCents || 0) / 100).toFixed(2)}</Text>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{e.vaultItems || 0} items · {e.vaultDownloads || 0} downloads</Text>
      </View>

      {/* Students */}
      <SectionHeading title={`Students (${students.length})`} />
      {students.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No students yet. Complete sessions to build your roster.</Text>
      ) : null}
      {students.map((s, i) => (
        <View key={i} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>{s.studentName}</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{s.sessionCount} sessions · ${((s.totalEarned || 0) / 100).toFixed(0)} earned</Text>
          </View>
        </View>
      ))}

      {/* Upcoming calendar */}
      <SectionHeading title="Upcoming events" />
      {events.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No scheduled events.</Text>
      ) : null}
      {events.slice(0, 5).map((ev) => (
        <View key={ev.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>{ev.title}</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{new Date(ev.startAt).toLocaleString()} · {ev.type}</Text>
          </View>
        </View>
      ))}

      {/* Invoices */}
      <SectionHeading title={`Invoices (${invoices.length})`} />
      {invoices.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No invoices yet.</Text>
      ) : null}
      {invoices.slice(0, 5).map((inv) => (
        <View key={inv.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="receipt-outline" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>{inv.description}</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{inv.studentName} · ${(inv.amountCents / 100).toFixed(2)} · {inv.status}</Text>
          </View>
          {inv.status === 'draft' ? (
            <HapticPressable onPress={() => void request(`/marketplace/business/invoices/${inv.id}/send`, { method: 'POST' }).then(() => setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: 'sent' } : i)))} style={[styles.smallBtn, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.smallBtnText, { color: colors.primary }]}>Send</Text>
            </HapticPressable>
          ) : inv.status === 'sent' ? (
            <HapticPressable onPress={() => void request(`/marketplace/business/invoices/${inv.id}/paid`, { method: 'POST' }).then(() => setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: 'paid' } : i)))} style={[styles.smallBtn, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.smallBtnText, { color: colors.primary }]}>Mark paid</Text>
            </HapticPressable>
          ) : null}
        </View>
      ))}

    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpi: { borderRadius: 16, borderWidth: 1, flexBasis: '47%', flexGrow: 1, padding: 14 },
  kpiLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  kpiValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 4 },
  card: { borderRadius: 16, gap: 4, marginBottom: 12, padding: 14 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  cardValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  row: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 6, padding: 10 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8, paddingHorizontal: 4 },
  smallBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  smallBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
});
