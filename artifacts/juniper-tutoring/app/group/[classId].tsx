import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

type GroupClass = {
  id: string; tutorId: string; title: string; subject: string; description: string | null;
  pricePerStudentCents: number; maxStudents: number; scheduledAt: string; durationMinutes: number;
  status: string; recordingUrl: string | null; tutorName: string;
  enrollments: Array<{ id: string; studentId: string; status: string; paidCents: number; studentName: string }>;
  enrollmentCount: number;
};

export default function GroupClassDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user, request } = useAuth();
  const [cls, setCls] = useState<GroupClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const data = await request<GroupClass>(`/marketplace/group-classes/${classId}`);
      setCls(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load class.');
    } finally {
      setLoading(false);
    }
  }, [classId, request]);

  useEffect(() => { void load(); }, [load]);

  const enroll = async () => {
    if (!user) { router.push('/(auth)/welcome' as never); return; }
    setEnrolling(true);
    setError('');
    try {
      await request(`/marketplace/group-classes/${classId}/enroll`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enroll.');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) return <Screen><PageHeader title="Group class" onBack={() => router.back()} /><Text style={{ color: colors.mutedForeground, padding: 20 }}>Loading…</Text></Screen>;
  if (!cls) return <Screen><PageHeader title="Not found" onBack={() => router.back()} /><EmptyState icon="people-outline" title="Class not found" description={error} /></Screen>;

  const isEnrolled = cls.enrollments.some((e) => e.studentId === user?.id);
  const isFull = cls.enrollments.length >= cls.maxStudents;

  return (
    <Screen>
      <PageHeader title={cls.title} onBack={() => router.back()} />
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Text style={[styles.heroSubject, { color: colors.primaryForeground }]}>{cls.subject}</Text>
        <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>{cls.title}</Text>
        <Text style={[styles.heroMeta, { color: colors.primaryForeground }]}>
          {cls.tutorName} · {new Date(cls.scheduledAt).toLocaleString()} · {cls.durationMinutes} min
        </Text>
        <Text style={[styles.heroPrice, { color: colors.primaryForeground }]}>
          ${(cls.pricePerStudentCents / 100).toFixed(2)} per student
        </Text>
      </View>
      {cls.description ? <Text style={[styles.desc, { color: colors.mutedForeground }]}>{cls.description}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {!isEnrolled && cls.status === 'scheduled' && !isFull ? (
        <ActionButton label={enrolling ? 'Enrolling…' : 'Enroll in this class'} icon="add" onPress={() => void enroll()} disabled={enrolling} />
      ) : isEnrolled ? (
        <View style={[styles.enrolledBadge, { backgroundColor: colors.leaf }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={[styles.enrolledText, { color: colors.primary }]}>You're enrolled</Text>
        </View>
      ) : isFull ? (
        <Text style={[styles.fullText, { color: colors.mutedForeground }]}>This class is full.</Text>
      ) : null}

      <SectionHeading title={`Enrolled students (${cls.enrollments.length}/${cls.maxStudents})`} />
      {cls.enrollments.map((e) => (
        <View key={e.id} style={[styles.studentRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={16} color={colors.primary} />
          <Text style={[styles.studentName, { color: colors.foreground }]}>{e.studentName}</Text>
          <Text style={[styles.studentStatus, { color: colors.mutedForeground }]}>{e.status}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, gap: 4, marginBottom: 12, padding: 18 },
  heroSubject: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  heroMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  heroPrice: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 6 },
  desc: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8 },
  enrolledBadge: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 12 },
  enrolledText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  fullText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 12 },
  studentRow: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 6, padding: 10 },
  studentName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  studentStatus: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});