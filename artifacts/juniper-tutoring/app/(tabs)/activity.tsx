import React, { useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';
import { useJuniper } from '@/context/JuniperContext';
import {
  ActionButton,
  EmptyState,
  PageHeader,
  PreviewNotice,
  Screen,
  SectionHeading,
  StatusPill,
  TutorPortrait,
} from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { SkeletonBlock } from '@/components/LoadingSkeleton';
import { useAuth } from '@/context/AuthContext';

type AccountRequest = {
  id: string;
  title: string;
  subject: string;
  customSubject?: string | null;
  instructionLanguage?: string | null;
  status: string;
  offerCount: number;
  deadline: string;
  serviceType?: string;
};
type AccountBooking = {
  id: string;
  status: string;
  amountCents: number;
  title: string;
  subject: string;
  tutorName: string;
  learnerName: string;
  createdAt: string;
  scheduledAt: string | null;
  durationMinutes: number;
  serviceType?: string;
  solutionSummary?: string | null;
};

function normalizeAccountBookings(value: unknown): AccountBooking[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { bookings?: unknown }).bookings)
      ? (value as { bookings: unknown[] }).bookings
      : [];

  return records.flatMap((record) => {
    if (!record || typeof record !== 'object') return [];
    const item = record as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id) return [];

    const numberOrZero = (candidate: unknown) => {
      const number = Number(candidate);
      return Number.isFinite(number) ? number : 0;
    };
    const stringOrEmpty = (candidate: unknown) => typeof candidate === 'string' ? candidate : '';
    const scheduledAt = typeof item.scheduledAt === 'string' && !Number.isNaN(Date.parse(item.scheduledAt))
      ? item.scheduledAt
      : null;

    return [{
      id: item.id,
      status: stringOrEmpty(item.status) || 'scheduled',
      amountCents: numberOrZero(item.amountCents),
      title: stringOrEmpty(item.title),
      subject: stringOrEmpty(item.subject),
      tutorName: stringOrEmpty(item.tutorName),
      learnerName: stringOrEmpty(item.learnerName),
      createdAt: stringOrEmpty(item.createdAt),
      scheduledAt,
      durationMinutes: numberOrZero(item.durationMinutes),
      serviceType: stringOrEmpty(item.serviceType) || undefined,
      solutionSummary: typeof item.solutionSummary === 'string' ? item.solutionSummary : null,
    }];
  });
}

export default function ActivityScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, completeBooking } = useJuniper();
  const { user, request } = useAuth();
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([]);
  const [accountBookings, setAccountBookings] = useState<AccountBooking[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [activeSegment, setActiveSegment] = useState<'requests' | 'sessions'>('requests');

  useEffect(() => {
    if (!user) return;
    let active = true;
    setAccountLoading(true);
    void Promise.all([
      request<AccountRequest[]>('/marketplace/requests/mine'),
      request<unknown>('/marketplace/bookings'),
    ]).then(([requests, bookings]) => {
      if (active) {
        setAccountRequests(requests);
        setAccountBookings(normalizeAccountBookings(bookings));
        setAccountError('');
      }
    }).catch((error: unknown) => {
      if (active) setAccountError(error instanceof Error ? error.message : 'Your learning space could not be loaded.');
    }).finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, [user, request]);

  if (user) {
    const isLearner = user.activeRole === 'student';
    return (
      <Screen>
        <PageHeader
          title={isLearner ? 'My learning' : 'Tutor sessions'}
          eyebrow={isLearner ? 'Requests and sessions' : 'Sessions and requests'}
        />
        {accountError ? <Text style={[styles.accountError, { color: colors.destructive }]}>{accountError}</Text> : null}
        {accountLoading ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <SkeletonBlock style={{ height: 72, borderRadius: 18 }} />
            <SkeletonBlock style={{ height: 72, borderRadius: 18 }} />
            <SkeletonBlock style={{ height: 72, borderRadius: 18 }} />
          </View>
        ) : null}
        {isLearner ? (
          <View accessibilityRole="tablist" style={[styles.segmentBar, { backgroundColor: colors.leaf }]}>
            {([
              { id: 'requests' as const, label: 'Requests', count: accountRequests.length },
              { id: 'sessions' as const, label: 'Sessions', count: accountBookings.length },
            ]).map((item) => {
              const selected = activeSegment === item.id;
              return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setActiveSegment(item.id)} style={[styles.segment, selected && { backgroundColor: colors.card }]}>
                <Text style={[styles.segmentLabel, { color: selected ? colors.primary : colors.secondaryForeground }]}>{item.label}</Text>
                <Text style={[styles.segmentCount, { color: selected ? colors.primary : colors.mutedForeground }]}>{item.count}</Text>
              </Pressable>;
            })}
          </View>
        ) : null}
        {isLearner && activeSegment === 'requests' ? (
          <>
            <SectionHeading title="Your tutoring requests" action="New request" onAction={() => router.push('/request')} />
            {accountRequests.length ? (
              accountRequests.map((item) => (
                <HapticPressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/requests/${item.id}`)}
                  style={({ pressed }) => [
                    styles.requestRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: item.status === 'open' ? colors.primary : colors.border,
                      borderWidth: item.status === 'open' ? 1.5 : 1,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <View style={[styles.requestIcon, { backgroundColor: item.status === 'open' ? colors.urgentRedLight : colors.leaf }]}>
                    <Ionicons name={item.status === 'open' ? 'flash' : 'document-text'} size={18} color={item.status === 'open' ? colors.urgentRed : colors.primary} />
                  </View>
                  <View style={styles.requestCopy}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text numberOfLines={1} style={[styles.requestTitle, { color: colors.foreground }]}>{item.title}</Text>
                    </View>
                    <Text style={[styles.requestMeta, { color: item.offerCount > 0 ? colors.primary : colors.mutedForeground, fontFamily: item.offerCount > 0 ? 'Inter_700Bold' : 'Inter_400Regular' }]}>
                      {[item.customSubject || item.subject, item.instructionLanguage ? `Tutoring in ${item.instructionLanguage}` : null, item.offerCount > 0 ? `${item.offerCount} ${item.offerCount === 1 ? 'offer' : 'offers'} to review` : 'Waiting for tutor replies'].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <StatusPill
                    label={item.status === 'matched' ? 'Tutor chosen' : item.offerCount === 0 ? 'Awaiting offers' : `${item.offerCount} ${item.offerCount === 1 ? 'offer' : 'offers'}`}
                    tone={item.status === 'matched' ? 'green' : 'clay'}
                  />
                </HapticPressable>
              ))
            ) : !accountLoading ? (
              <EmptyState
                icon="document-text-outline"
                title="No tutoring requests yet"
                description="Share the subject you want help with and compare replies from tutors."
                action="Create a request"
                onAction={() => router.push('/request')}
              />
            ) : null}
          </>
        ) : null}
        {(!isLearner || activeSegment === 'sessions') ? <>
        <SectionHeading title={isLearner ? 'Sessions' : 'Your sessions'} />
        {accountBookings.length ? (
          accountBookings.map((booking) => {
            const isAssignment = booking.serviceType !== 'live_session';
            const walkthroughReady = Boolean(booking.solutionSummary);
            return (
              <View
                key={booking.id}
                style={[
                  styles.bookingCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: walkthroughReady ? colors.liveEmerald : colors.border,
                    borderWidth: walkthroughReady ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.bookingMain}>
                  <View style={[styles.accountAvatar, { backgroundColor: colors.leaf }]}>
                    <Ionicons name={isAssignment ? 'school' : 'videocam'} size={19} color={colors.primary} />
                  </View>
                  <View style={styles.bookingInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.bookingName, { color: colors.foreground }]}>
                        {isLearner ? booking.tutorName : booking.learnerName}
                      </Text>
                      {walkthroughReady ? (
                        <View style={{ backgroundColor: colors.liveEmeraldLight, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: colors.liveEmerald, fontFamily: 'Inter_700Bold', fontSize: 10 }}>Session recap</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.bookingSubject, { color: colors.mutedForeground }]}>
                      {booking.subject} · {booking.title}
                    </Text>
                    <Text style={[styles.bookingTime, { color: colors.primary }]}>
                      {walkthroughReady
                        ? 'Your tutor shared a learning recap'
                        : booking.status === 'completed'
                        ? 'Milestone: Completed'
                        : booking.status === 'completed' ? 'Session complete' : 'Session space is open'}
                    </Text>
                  </View>
                  <StatusPill
                    label={booking.status === 'completed' ? 'Done' : 'Active'}
                    tone={booking.status === 'completed' ? 'neutral' : 'green'}
                  />
                </View>
                <View style={[styles.bookingDivider, { backgroundColor: colors.border }]} />
                <View style={styles.bookingActions}>
                  <Text style={[styles.bookingPrice, { color: colors.foreground }]}>
                    ${(booking.amountCents / 100).toFixed(0)} USD · arranged directly
                  </Text>
                  <HapticPressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/workroom/${booking.id}`)}
                    style={({ pressed }) => [styles.chatButton, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
                  >
                    <Ionicons name="folder-open" size={16} color="#FFFFFF" />
                    <Text style={[styles.chatButtonText, { color: '#FFFFFF' }]}>Open session</Text>
                  </HapticPressable>
                </View>
              </View>
            );
          })
        ) : !accountLoading ? (
          <EmptyState
            icon="calendar-outline"
            title={isLearner ? 'No sessions yet' : 'No sessions yet'}
            description={
              isLearner
                ? 'Choose a tutor offer to arrange your first session.'
                : 'Browse learner requests and send an offer when you can help.'
            }
            action={isLearner ? 'Find a tutor' : 'Browse requests'}
            onAction={() => router.push('/(tabs)/find')}
          />
        ) : null}
        </> : null}
      </Screen>
    );
  }

  if (!__DEV__) return <Screen><PageHeader title="My learning" eyebrow="Requests and sessions" /><EmptyState icon="person-circle-outline" title="Your learning in one place" description="Sign in to manage tutoring requests, messages, and sessions." action="Sign in" onAction={() => router.push('/(auth)/welcome')} /></Screen>;

  const visibleBookings =
    state.role === 'student'
      ? state.bookings
      : state.bookings.filter((booking) => booking.tutorId === state.tutorProfileId);

  return (
    <Screen>
      <PageHeader
        title={state.role === 'student' ? 'My learning' : 'Tutor sessions'}
        eyebrow={state.role === 'student' ? 'Requests and sessions' : 'Sessions and requests'}
      />
      <PreviewNotice />

      {state.role === 'student' ? (
        <>
          <SectionHeading title="Your tutoring requests" />
          {state.requests.length ? (
            state.requests.map((request) => {
              const offersCount = state.offers.filter(
                (offer) => offer.requestId === request.id,
              ).length;
              return (
                <HapticPressable
                  accessibilityRole="button"
                  key={request.id}
                  onPress={() => router.push(`/requests/${request.id}`)}
                  style={({ pressed }) => [
                    styles.requestRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.83 : 1,
                    },
                  ]}
                >
                  <View style={[styles.requestIcon, { backgroundColor: colors.leaf }]}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.requestCopy}>
                    <Text style={[styles.requestTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {request.title}
                    </Text>
                    <Text style={[styles.requestMeta, { color: colors.mutedForeground }]}>
                      {request.subject} · {offersCount} {offersCount === 1 ? 'offer' : 'offers'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
                </HapticPressable>
              );
            })
          ) : (
            <EmptyState
              icon="document-text-outline"
              title="No tutoring requests yet"
              description="Tell tutors what you want to learn and compare the offers you receive."
              action="Create a request"
              onAction={() => router.push('/request')}
            />
          )}
        </>
      ) : null}

      <SectionHeading title="Your sessions" />
      {visibleBookings.length ? (
        visibleBookings.map((booking) => {
          const tutor = SAMPLE_TUTORS.find((item) => item.id === booking.tutorId);
          if (!tutor) return null;
          return (
            <View
              key={booking.id}
              style={[
                styles.bookingCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.bookingMain}>
                <TutorPortrait tutor={tutor} size="small" />
                <View style={styles.bookingInfo}>
                  <Text style={[styles.bookingName, { color: colors.foreground }]}>{tutor.name}</Text>
                  <Text style={[styles.bookingSubject, { color: colors.mutedForeground }]}>
                    {booking.subject}
                  </Text>
                  <Text style={[styles.bookingTime, { color: colors.primary }]}>{booking.slot}</Text>
                </View>
                <StatusPill
                  label={booking.status === 'completed' ? 'Done' : 'Active'}
                  tone={booking.status === 'completed' ? 'neutral' : 'green'}
                />
              </View>
              <View style={[styles.bookingDivider, { backgroundColor: colors.border }]} />
              <View style={styles.bookingActions}>
                <Text style={[styles.bookingPrice, { color: colors.foreground }]}>
                  Agreed · ${booking.price}
                </Text>
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open session space with ${tutor.name}`}
                  onPress={() => router.push(`/workroom/${booking.id}` as never)}
                  style={({ pressed }) => [
                    styles.chatButton,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons name="folder-open" size={16} color="#FFFFFF" />
                  <Text style={[styles.chatButtonText, { color: '#FFFFFF' }]}>Open session</Text>
                </HapticPressable>
              </View>
              {booking.status === 'upcoming' ? (
                <ActionButton
                  label="Mark session complete"
                  variant="quiet"
                  onPress={() => completeBooking(booking.id)}
                  testID={`complete-session-${booking.id}`}
                />
              ) : null}
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="folder-open-outline"
          title="No current sessions"
          description={
            state.role === 'student'
              ? 'Accept a tutor offer to plan your first session.'
              : 'Browse learner requests and send an offer when you can help.'
          }
          action={state.role === 'student' ? 'Find a tutor' : 'Browse requests'}
          onAction={() =>
            router.push(state.role === 'student' ? '/request' : '/(tabs)/find')
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentBar: { borderRadius: 17, flexDirection: 'row', gap: 5, marginTop: 2, padding: 5 },
  segment: { alignItems: 'center', borderRadius: 13, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  segmentLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  segmentCount: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  requestRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    minHeight: 76,
    paddingHorizontal: 16,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  requestIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  requestCopy: { flex: 1 },
  requestTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  requestMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4 },
  accountError: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, marginTop: 12 },
  accountAvatar: { alignItems: 'center', borderRadius: 16, height: 44, justifyContent: 'center', width: 44 },
  bookingCard: { borderRadius: 22, borderWidth: 1, marginBottom: 14, padding: 16, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  bookingMain: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  bookingInfo: { flex: 1 },
  bookingName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  bookingSubject: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 3 },
  bookingTime: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  bookingDivider: { height: 1, marginVertical: 14 },
  bookingActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bookingPrice: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  chatButton: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, minHeight: 38, paddingHorizontal: 14, paddingVertical: 8 },
  chatButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
