import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';
import { ActionButton, EmptyState, PageHeader, Pill, PreviewNotice, Screen, SectionHeading, StatusPill } from '@/components/JuniperUI';
import { ShareButton } from '@/components/ShareButton';
import { TutorKnowledgeVault } from '@/components/TutorKnowledgeVault';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { TutorProfileSkeleton } from '@/components/LoadingSkeleton';

type PublicTutor = {
  id: string;
  displayName: string;
  headline: string | null;
  biography: string | null;
  educationSummary: string | null;
  hourlyRateCents: number;
  levels: string[];
  availability: string[];
  timezone: string;
  averageRating: number;
  reviewCount: number;
  completedSessions: number;
  subjects: string[];
  courses?: Array<{ id: string; university: string; code: string; name: string }>;
  availabilitySlots?: Array<{ id: string; dayOfWeek: string; startTime: string; endTime: string }>;
};

export default function TutorProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request, user } = useAuth();
  const [tutor, setTutor] = useState<PublicTutor | null>(null);
  const [tags, setTags] = useState<Array<{ id: string; tagString: string; endorsementCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sample = __DEV__ ? SAMPLE_TUTORS.find((item) => item.id === id) : undefined;

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');
    void request<PublicTutor>(`/marketplace/tutors/${encodeURIComponent(id)}`).then((profile) => {
      if (active) setTutor(profile);
    }).catch((caught: unknown) => {
      if (!active) return;
      if (sample) {
        setTutor({
          id: sample.id, displayName: sample.name, headline: sample.focus, biography: sample.about,
          educationSummary: null, hourlyRateCents: sample.hourlyRate * 100, levels: [],
          availability: [], timezone: '', averageRating: 0, reviewCount: 0, completedSessions: 0,
          subjects: sample.subjects,
        });
      } else {
        setError(caught instanceof Error ? caught.message : 'This tutor profile could not be loaded.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, request, sample?.id]);

  useEffect(() => {
    if (!id) return;
    void request<Array<{ id: string; tagString: string; endorsementCount: number }>>(`/marketplace/tutors/${encodeURIComponent(id)}/tags`)
      .then((rows) => setTags(rows || []))
      .catch(() => setTags([]));
  }, [id, request]);

  const isSample = Boolean(sample && tutor?.id === sample.id);
  const displayName = tutor?.displayName ?? '';

  return (
    <Screen>
      <PageHeader
        title={displayName || 'Tutor profile'}
        eyebrow={isSample ? 'Sample tutor profile' : 'Juniper tutor'}
        onBack={() => router.back()}
      />
      {isSample ? <PreviewNotice message="Fictional tutor listing. Credentials and identity are not verified." /> : null}
      {loading ? <TutorProfileSkeleton /> : null}
      {!loading && !tutor ? (
        <EmptyState
          icon="person-circle-outline"
          title="This tutor profile isn’t available"
          description={error || 'The profile may have been paused or removed. Browse the approved tutors available now.'}
          action="Browse tutors"
          onAction={() => router.replace('/(tabs)/find')}
        />
      ) : null}
      {tutor ? <>
        <View style={[styles.profileHero, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderTopColor: '#2A5240' }]}>
          {isSample && sample ? (
            <Image source={sample.photo} style={[styles.heroImage, { backgroundColor: colors.card }]} />
          ) : (
            <View style={[styles.realHeroImage, { backgroundColor: colors.leaf }]}>
              <Ionicons name="school-outline" size={42} color={colors.accent} />
            </View>
          )}
          <View style={styles.profileTitleWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <StatusPill label={isSample ? 'Sample profile' : 'Reviewed by Juniper'} tone="green" />
              <ShareButton
                tutorId={tutor.id}
                tutorName={displayName}
                headline={tutor.headline}
                subjects={tutor.subjects}
                hourlyRate={tutor.hourlyRateCents / 100}
                variant="pill"
                label="Share"
              />
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text>
            <Text style={[styles.profileSubject, { color: colors.mutedForeground }]}>{tutor.headline || tutor.subjects.join(' · ')}</Text>
            <Text style={[styles.profileRate, { color: colors.accent }]}>${(tutor.hourlyRateCents / 100).toFixed(0)}<Text style={[styles.profileRateLabel, { color: colors.mutedForeground }]}> / hour · proposed rate</Text></Text>
          </View>
        </View>

        {tutor.reviewCount > 0 ? (
          <View style={[styles.trustCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderTopColor: '#2A5240' }]}>
            <Ionicons name="star" size={17} color={colors.orange} />
            <Text style={[styles.trustText, { color: colors.foreground }]}>{Number(tutor.averageRating).toFixed(1)} from {tutor.reviewCount} learner {tutor.reviewCount === 1 ? 'review' : 'reviews'} · {tutor.completedSessions} completed sessions</Text>
          </View>
        ) : (
          <View style={[styles.trustCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderTopColor: '#2A5240' }]}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.accent} />
            <Text style={[styles.trustText, { color: colors.foreground }]}>This tutor’s application was reviewed by Juniper. Learn about their teaching approach and experience below.</Text>
          </View>
        )}

        <SectionHeading title="A little about their teaching" />
        <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>{tutor.biography || 'This tutor has not added a teaching introduction yet.'}</Text>
        {tutor.educationSummary ? <View style={[styles.approachCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="school-outline" size={18} color={colors.primary} /><Text style={[styles.approachText, { color: colors.foreground }]}>{tutor.educationSummary}</Text></View> : null}

        <SectionHeading title="Subjects they teach" />
        <View style={styles.tagRow}>{tutor.subjects.map((subject) => <Pill key={subject} label={subject} />)}</View>
        {tutor.levels.length ? <>
          <SectionHeading title="Learner levels" />
          <View style={styles.tagRow}>{tutor.levels.map((level) => <Pill key={level} label={level === 'all' ? 'All levels' : level} />)}</View>
        </> : null}
        {tutor.availability.length ? <View style={[styles.approachCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="time-outline" size={18} color={colors.primary} /><Text style={[styles.approachText, { color: colors.foreground }]}>Usually available {tutor.availability.join(', ')}{tutor.timezone ? ` · ${tutor.timezone}` : ''}</Text></View> : null}

        {/* Course catalogue matches and tutor supplied institution details */}
        {tutor.courses && tutor.courses.length > 0 ? (
          <>
            <SectionHeading title={`University courses (${tutor.courses.length})`} />
            <View style={styles.courseTagRow}>
              {tutor.courses.map((course) => (
                <View
                  key={course.id}
                  style={[styles.profileCoursePill, { backgroundColor: colors.leaf, borderColor: colors.primary }]}
                >
                  <Text style={[styles.profileCourseUni, { color: colors.primary }]}>{course.university}</Text>
                  <Text style={[styles.profileCourseCode, { color: colors.foreground }]}>{course.code}</Text>
                  <Text numberOfLines={1} style={[styles.profileCourseName, { color: colors.mutedForeground }]}>
                    · {course.name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Epic 2: Direct Time-Slot Availability */}
        {tutor.availabilitySlots && tutor.availabilitySlots.length > 0 ? (
          <>
            <SectionHeading title="Recurring weekly slots" />
            <View style={styles.slotsCardWrap}>
              {tutor.availabilitySlots.map((slot) => (
                <View
                  key={slot.id}
                  style={[styles.slotItemPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                  <Text style={[styles.slotItemDay, { color: colors.foreground }]}>
                    {slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1, 3)}
                  </Text>
                  <Text style={[styles.slotItemTime, { color: colors.primary }]}>
                    {slot.startTime}–{slot.endTime}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        
        {/* Epic 4: Tutor Knowledge Vault (Public Study Notes & Recaps) */}
        <TutorKnowledgeVault tutorUserId={tutor.id} isOwner={user?.id === tutor.id} />

        {tags.length ? (
          <>
            <SectionHeading title="Endorsed skills" />
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <View
                  key={tag.id}
                  style={[styles.endorsementChip, { backgroundColor: colors.leaf, borderColor: colors.accent }]}
                >
                  <Text style={[styles.endorsementTag, { color: colors.primary }]}>{tag.tagString}</Text>
                  <Text style={[styles.endorsementCount, { color: colors.accent }]}>+{tag.endorsementCount}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Payment terms are arranged directly by each tutor and learner. */}
        
        {!isSample ? (
          <View style={styles.cta}>
            <ActionButton
              label={`Request a session with ${displayName.split(' ')[0]}`}
              icon="chatbubble-ellipses-outline"
              onPress={() => router.push({ pathname: '/request', params: { tutorId: tutor.id, tutorName: displayName, subject: tutor.subjects[0] ?? '' } })}
            />
            <View style={{ marginTop: 10 }}>
              <ActionButton
                label="Ask about an available time"
                icon="calendar-outline"
                variant="secondary"
                onPress={() => router.push({ pathname: `/book/${tutor.id}`, params: { tutorName: displayName, subject: tutor.subjects[0] ?? '' } } as never)}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <ShareButton
                tutorId={tutor.id}
                tutorName={displayName}
                headline={tutor.headline}
                subjects={tutor.subjects}
                hourlyRate={tutor.hourlyRateCents / 100}
                variant="secondary"
                label="Share Profile on WhatsApp"
              />
            </View>
          </View>
        ) : null}
      </> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHero: { alignItems: 'center', flexDirection: 'row', gap: 17, marginTop: 18, padding: 16, borderRadius: 22 },
  heroImage: { borderRadius: 18, height: 140, width: 114 },
  realHeroImage: { alignItems: 'center', borderRadius: 18, height: 140, justifyContent: 'center', width: 114 },
  profileTitleWrap: { flex: 1, gap: 8 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.6, lineHeight: 30 },
  profileSubject: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  profileRate: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4, marginTop: 2, fontVariant: ['tabular-nums'] },
  profileRateLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  trustCard: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 10, marginTop: 16, padding: 14 },
  trustText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  aboutText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  approachCard: { alignItems: 'center', borderRadius: 18, borderWidth: 1, borderTopColor: '#2A5240', flexDirection: 'row', gap: 11, marginTop: 12, padding: 14 },
  approachText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  paymentNotice: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 16, padding: 12 },
  paymentNoticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  cta: { marginTop: 18 },
  courseTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  profileCoursePill: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  profileCourseUni: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  profileCourseCode: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  profileCourseName: { fontFamily: 'Inter_400Regular', fontSize: 11, maxWidth: 160 },
  slotsCardWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  slotItemPill: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  slotItemDay: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  slotItemTime: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  endorsementChip: { alignItems: 'center', borderRadius: 99, borderWidth: 1.5, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#D4A574', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 2 },
  endorsementTag: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  endorsementCount: { fontFamily: 'Inter_700Bold', fontSize: 11 },
});
