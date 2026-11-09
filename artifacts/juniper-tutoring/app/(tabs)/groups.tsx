import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';

type GroupClass = {
  id: string; tutorId: string; title: string; subject: string; description: string | null;
  pricePerStudentCents: number; maxStudents: number; scheduledAt: string; durationMinutes: number;
  status: string; tutorName: string; enrollmentCount: number;
};

export default function GroupsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, request } = useAuth();
  const [classes, setClasses] = useState<GroupClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('All');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const q = subject !== 'All' ? `?subject=${encodeURIComponent(subject)}` : '';
    void request<GroupClass[]>(`/marketplace/group-classes${q}`)
      .then((rows) => { if (active) setClasses(rows || []); })
      .catch(() => { if (active) setClasses([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subject, request]);

  const subjects = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'Writing', 'Biology'];

  return (
    <Screen>
      <PageHeader title="Group sessions" eyebrow="Juniper tutoring" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {subjects.map((s) => (
          <HapticPressable key={s} onPress={() => setSubject(s)} style={[styles.pill, { backgroundColor: subject === s ? colors.primary : colors.card, borderColor: subject === s ? colors.primary : colors.border }]}>
            <Text style={[styles.pillText, { color: subject === s ? colors.primaryForeground : colors.foreground }]}>{s}</Text>
          </HapticPressable>
        ))}
      </ScrollView>
      {loading ? <Text style={{ color: colors.mutedForeground, padding: 20 }}>Loading classes…</Text> : null}
      {!loading && classes.length === 0 ? (
        <EmptyState icon="people-outline" title="Group sessions aren’t available yet" description="Juniper is focused on helping students and tutors arrange one-to-one sessions first." />
      ) : null}
      {classes.map((cls) => (
        <HapticPressable key={cls.id} onPress={() => router.push(`/group/${cls.id}` as never)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTop}>
            <View style={[styles.subjectBadge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.subjectText, { color: colors.primary }]}>{cls.subject}</Text>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>${(cls.pricePerStudentCents / 100).toFixed(2)}/student</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{cls.title}</Text>
          {cls.description ? <Text numberOfLines={2} style={[styles.desc, { color: colors.mutedForeground }]}>{cls.description}</Text> : null}
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{cls.tutorName}</Text>
            <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{cls.enrollmentCount}/{cls.maxStudents}</Text>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{new Date(cls.scheduledAt).toLocaleString()}</Text>
          </View>
        </HapticPressable>
      ))}
      {user?.activeRole === 'tutor' ? (
        <View style={{ padding: 16, marginTop: 8 }}>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  card: { borderRadius: 18, borderWidth: 1, gap: 6, marginBottom: 10, padding: 14 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  subjectBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  subjectText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  desc: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  meta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});
