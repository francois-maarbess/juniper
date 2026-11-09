import React from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActionButton,
  BrandMark,
  EmptyState,
  PreviewNotice,
  Screen,
  SectionHeading,
} from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { createJuniperRealtimeSocket } from '@/lib/realtime';
import { HomeSkeleton } from '@/components/LoadingSkeleton';
import { HelpTypeGrid } from '@/components/HelpTypeGrid';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  if (user) return <AccountHome />;

  return <PublicHome />;
}

function PublicHome() {
  const colors = useColors();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');

  const submitSearch = () => {
    const q = searchQuery.trim();
    router.push({ pathname: '/(tabs)/find', params: q ? { query: q } : {} });
  };

  return (
    <Screen>
      <View style={styles.topLine}>
        <BrandMark />
        <HapticPressable accessibilityRole="button" onPress={() => router.push('/(auth)/welcome')} style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.leaf, width: 'auto', height: 40, minHeight: 40, paddingHorizontal: 12, opacity: pressed ? 0.72 : 1 }]}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>Sign in / Register</Text>
        </HapticPressable>
      </View>
      <View style={[styles.publicHero, { backgroundColor: colors.primary }]}>
        <View style={styles.publicHeroOrbit} />
        <View style={styles.publicHeroOrbit2} />
        <View style={styles.publicHeroHeading}>
          <Text style={[styles.publicHeroEyebrow, { color: colors.accent }]}>JUNIPER TUTORING</Text>
          <Text style={[styles.publicHeroTitle, { color: colors.primaryForeground }]}>Get unstuck.{'\n'}Get ahead.</Text>
          <Text style={[styles.publicHeroSub, { color: 'rgba(255,253,248,0.85)' }]}>Elite tutors. Zero platform fees. Your next session is a tap away.</Text>
        </View>
        <View style={[styles.searchWrap, styles.publicSearch, { backgroundColor: colors.card, borderColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Math, biology, French…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          <HapticPressable onPress={submitSearch} style={styles.searchButton}>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
          </HapticPressable>
        </View>
        <View style={styles.publicHeroCtaRow}>
          <HapticPressable onPress={() => router.push('/(tabs)/find')} style={[styles.publicHeroCta, { backgroundColor: colors.accent }]}>
            <Text style={[styles.publicHeroCtaText, { color: colors.primary }]}>Browse Tutors</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </HapticPressable>
          <HapticPressable onPress={() => router.push('/(auth)/welcome')} style={[styles.publicHeroCtaSecondary, { borderColor: colors.primaryForeground }]}>
            <Text style={[styles.publicHeroCtaSecondaryText, { color: colors.primaryForeground }]}>Get Started</Text>
          </HapticPressable>
        </View>
      </View>

      <SectionHeading title="Master any subject" />
      <HelpTypeGrid onSelect={(item) => router.push({ pathname: '/request', params: { helpType: item.id, serviceType: item.serviceType, ...(item.learningPath ? { learningPath: item.learningPath } : {}) } })} />


      <View style={{ marginTop: 28, gap: 14 }}>
      <SectionHeading title="From question to session" />
        {[
          { icon: 'create-outline' as const, title: 'State the problem', copy: 'Describe the subject, deadline, and what you need solved.' },
          { icon: 'people-outline' as const, title: 'Pick your tutor', copy: 'Compare profiles, rates, and response times. Choose with confidence.' },
          { icon: 'flash-outline' as const, title: 'Get it done', copy: 'Message, book, and start learning. No friction, no delays.' },
        ].map((step, index) => (
          <View key={step.title} style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={step.icon} size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.foreground }}>{step.title}</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: colors.mutedForeground }}>{step.copy}</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>{index + 1}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 24, marginBottom: 12, padding: 20, borderRadius: 22, backgroundColor: colors.pale, gap: 10 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_800ExtraBold', fontSize: 20, letterSpacing: -0.5 }}>Teach. Earn. Repeat.</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 }}>Set your subjects, rates, and availability. Students find you — not the other way around.</Text>
        <HapticPressable accessibilityRole="button" onPress={() => router.push('/become-tutor')} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14 }}>Start teaching →</Text>
        </HapticPressable>
      </View>
    </Screen>
  );
}

type AccountBooking = {
  id: string; status: string; amountCents: number; scheduledAt: string | null; durationMinutes: number;
  title: string; subject: string; tutorName: string; learnerName: string;
  learningRecap: string | null; nextSteps: string | null;
};
type AccountNotification = { id: string; title: string; body: string; readAt: string | null; targetPath: string | null };

function AccountHome() {
  const colors = useColors();
  const router = useRouter();
  const { user, request, setActiveRole } = useAuth();
  const role = user?.activeRole ?? 'student';
  const [bookings, setBookings] = React.useState<AccountBooking[]>([]);
  const [notifications, setNotifications] = React.useState<AccountNotification[]>([]);
  const [tutorStatus, setTutorStatus] = React.useState<string | null>(null);
  const [requestCount, setRequestCount] = React.useState(0);
  const [suggestedTutors, setSuggestedTutors] = React.useState<Array<{ id: string; displayName: string; subjects: string[]; hourlyRateCents: number; averageRating: number; reviewCount: number }>>([]);
  const [boardRequests, setBoardRequests] = React.useState<Array<{
    id: string; title: string; subject: string; budgetCents: number; isDirect: boolean; learnerDisplayName: string; deadline: string;
  }>>([]);
  const [tutorProfile, setTutorProfile] = React.useState<{
    approval: string; displayName: string; hourlyRateCents: number; subjects: Array<{ name: string }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [requestPrompt, setRequestPrompt] = React.useState('');
  const [assistingPrompt, setAssistingPrompt] = React.useState(false);

  const startWithPrompt = async () => {
    const prompt = requestPrompt.trim();
    if (prompt.length < 3 || assistingPrompt) return;
    setAssistingPrompt(true);
    setError('');
    try {
      const draft = await request<{ title: string; details: string }>('/marketplace/requests/assist', {
        method: 'POST', body: { prompt },
      });
      router.push({ pathname: '/request', params: { helpType: 'tutoring', draftTitle: draft.title, draftDetails: draft.details } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not prepare your request. Please try again.');
    } finally { setAssistingPrompt(false); }
  };

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [sessions, inbox] = await Promise.all([
          request<AccountBooking[]>('/marketplace/bookings'),
          request<AccountNotification[]>('/marketplace/notifications'),
        ]);
        if (!active) return;
        setBookings(sessions);
        setNotifications(inbox);
        if (role === 'student') {
          const [requests, profile, tutorRows] = await Promise.all([
            request<Array<{ id: string }>>('/marketplace/requests/mine'),
            request<{ approval: string } | null>('/marketplace/tutor-profile').catch(() => null),
            request<Array<{ id: string; displayName: string; subject: string; hourlyRateCents: number; averageRating: number; reviewCount: number }>>('/marketplace/tutors').catch(() => []),
          ]);
          if (active) {
            setRequestCount(requests.length);
            setTutorStatus(profile?.approval ?? null);
            const byId = new Map<string, (typeof suggestedTutors)[number]>();
            for (const row of tutorRows) {
              const current = byId.get(row.id) ?? { id: row.id, displayName: row.displayName, subjects: [], hourlyRateCents: row.hourlyRateCents, averageRating: row.averageRating, reviewCount: row.reviewCount };
              if (!current.subjects.includes(row.subject)) current.subjects.push(row.subject);
              byId.set(row.id, current);
            }
            setSuggestedTutors([...byId.values()].slice(0, 8));
          }
        } else {
          const [profile, board] = await Promise.all([
            request<typeof tutorProfile>('/marketplace/tutor-profile'),
            request<typeof boardRequests>('/marketplace/requests/board').catch(() => []),
          ]);
          if (active) {
            setTutorProfile(profile);
            setTutorStatus(profile?.approval ?? 'draft');
            setBoardRequests(board);
          }
        }
        if (active) setError('');
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Your Juniper space could not be loaded.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [request, role]);

  React.useEffect(() => {
    if (!user) return;
    const socket = createJuniperRealtimeSocket();
    socket?.on('notification:new', (item: AccountNotification) => {
      if (!item?.id) return;
      setNotifications((current) => current.some((notification) => notification.id === item.id)
        ? current : [item, ...current].slice(0, 30));
    });
    return () => { socket?.disconnect(); };
  }, [user]);

  const upcoming = bookings.filter((item) =>
    item.status === 'in_progress' || (item.status === 'scheduled' && (!item.scheduledAt || Date.parse(item.scheduledAt) >= Date.now())),
  ).sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    return (a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER)
      - (b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER);
  })[0];
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const openNotification = async (item: AccountNotification) => {
    if (!item.readAt) {
      setNotifications((current) => current.map((notification) => notification.id === item.id
        ? { ...notification, readAt: new Date().toISOString() } : notification));
      void request(`/marketplace/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => undefined);
    }
    if (item.targetPath) router.push(item.targetPath as never);
  };

  const directInquiries = boardRequests.filter((r) => r.isDirect);
  const completedSessions = bookings.filter((b) => b.status === 'completed').length;
  const activeSessions = bookings.filter((b) => b.status === 'scheduled' || b.status === 'in_progress').length;

  if (role === 'tutor') {
    return (
      <Screen>
        <View style={styles.topLine}>
          <BrandMark />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HapticPressable
              accessibilityRole="button"
              onPress={() => void setActiveRole('student')}
              style={({ pressed }) => [
                styles.roleSwitchBtn,
                { backgroundColor: colors.leaf, borderColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
              <Text style={[styles.roleSwitchBtnText, { color: colors.primary }]}>Learner View</Text>
            </HapticPressable>
            <View style={[styles.accountCountPill, { backgroundColor: colors.pale }]}>
              <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
              <Text style={[styles.accountCountText, { color: colors.primary }]}>{unreadCount ? `${unreadCount} new` : 'Studio'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.accountIntro}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text style={[styles.tutorStudioBadge, { color: colors.primary }]}>
              {tutorProfile?.subjects?.map((s) => s.name).join(' · ') || 'Approved Tutor'}
            </Text>
          </View>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            Your tutoring practice
          </Text>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            Welcome back, {user?.firstName}. Here’s what needs your attention.
          </Text>
        </View>

        {error ? <Text style={[styles.accountError, { color: colors.destructive }]}>{error}</Text> : null}

        {/* 4 KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Sessions completed</Text>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{completedSessions}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Active sessions</Text>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{activeSessions}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: directInquiries.length ? colors.primary : colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Requests for you</Text>
            <Text style={[styles.kpiValue, { color: directInquiries.length ? colors.primary : colors.foreground }]}>{directInquiries.length}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Open learner requests</Text>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{boardRequests.length}</Text>
          </View>
        </View>

        {/* Direct Inquiries Priority Alert */}
        <SectionHeading
          title={directInquiries.length ? `Requests for you (${directInquiries.length})` : 'Requests for you'}
          action={directInquiries.length ? 'View requests' : undefined}
          onAction={() => router.push({ pathname: '/(tabs)/find', params: { requestId: directInquiries[0]?.id } } as never)}
        />
        {directInquiries.length ? (
          directInquiries.map((direct) => (
            <View key={direct.id} style={[styles.directInquiryCard, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
              <View style={styles.directInquiryTop}>
                <View style={[styles.directInquiryIcon, { backgroundColor: colors.card }]}>
                  <Ionicons name="sparkles" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.directInquiryLearner, { color: colors.foreground }]}>{direct.learnerDisplayName} is looking for help</Text>
                  <Text style={[styles.directInquiryTitle, { color: colors.primary }]}>{direct.subject} · {direct.title}</Text>
                </View>
                <View style={[styles.directInquiryBudget, { backgroundColor: colors.card }]}>
                  <Text style={[styles.directInquiryBudgetText, { color: colors.primary }]}>${direct.budgetCents / 100}</Text>
                </View>
              </View>
              <ActionButton
                label="Respond with offer"
                icon="arrow-forward"
                onPress={() => router.push({ pathname: '/(tabs)/find', params: { requestId: direct.id } } as never)}
              />
            </View>
          ))
        ) : (
          <View style={[styles.quietCard, { backgroundColor: colors.pale }]}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={[styles.quietCardText, { color: colors.foreground }]}>
              Requests from students who chose your profile will appear here.
            </Text>
          </View>
        )}

        {/* Upcoming Confirmed Sessions */}
        <SectionHeading title="Upcoming session" action="All sessions" onAction={() => router.push('/(tabs)/activity')} />
        {upcoming ? (
          <HapticPressable
            accessibilityRole="button"
            onPress={() => router.push(`/workroom/${upcoming.id}` as never)}
            style={[styles.accountSessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.accountSessionIcon, { backgroundColor: colors.leaf }]}>
              <Ionicons name="calendar-outline" size={19} color={colors.primary} />
            </View>
            <View style={styles.accountSessionCopy}>
              <Text style={[styles.accountSessionTitle, { color: colors.foreground }]}>
                {upcoming.subject} · {upcoming.title}
              </Text>
              <Text style={[styles.accountSessionMeta, { color: colors.mutedForeground }]}>
                with {upcoming.learnerName} · {upcoming.scheduledAt ? new Date(upcoming.scheduledAt).toLocaleString() : 'Time to be arranged'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.primary} />
          </HapticPressable>
        ) : loading ? (
          <PreviewNotice message="Gathering your schedule…" />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No sessions scheduled"
            description="Review learner requests and send an offer when you can help."
            action="Browse requests"
            onAction={() => router.push('/(tabs)/find')}
          />
        )}

        {/* Studio Quick Actions */}
        <SectionHeading title="Studio tools" />
        <View style={{ gap: 10 }}>
          <ActionButton
            label={`Browse Job Board (${boardRequests.length} available)`}
            icon="list"
            onPress={() => router.push('/(tabs)/find')}
          />
          <ActionButton
            label="Edit Teaching Profile & Rates"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push('/become-tutor')}
          />
        </View>

        {/* Notifications */}
        {notifications.length ? (
          <>
            <SectionHeading title="Recent updates" />
            {notifications.slice(0, 3).map((item) => (
              <HapticPressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => void openNotification(item)}
                style={[styles.accountNotification, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name={item.readAt ? 'checkmark-circle-outline' : 'sparkles-outline'} size={17} color={colors.primary} />
                <View style={styles.accountSessionCopy}>
                  <Text style={[styles.accountSessionTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text numberOfLines={2} style={[styles.accountSessionMeta, { color: colors.mutedForeground }]}>{item.body}</Text>
                </View>
              </HapticPressable>
            ))}
          </>
        ) : null}
      </Screen>
    );
  }

  // Learner View
  return (
    <Screen>
      <View style={styles.topLine}>
        <BrandMark />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {tutorStatus === 'approved' ? (
            <HapticPressable
              accessibilityRole="button"
              onPress={() => void setActiveRole('tutor')}
              style={({ pressed }) => [
                styles.roleSwitchBtn,
                { backgroundColor: colors.leaf, borderColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="briefcase-outline" size={13} color={colors.primary} />
              <Text style={[styles.roleSwitchBtnText, { color: colors.primary }]}>Tutor Studio</Text>
            </HapticPressable>
          ) : null}
          <View style={[styles.accountCountPill, { backgroundColor: colors.pale }]}>
            <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
            <Text style={[styles.accountCountText, { color: colors.primary }]}>{unreadCount ? `${unreadCount} new` : 'Student Hub'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.accountIntro}>
        <Text style={[styles.tutorStudioBadge, { color: colors.accent }]}>WELCOME BACK, {user?.firstName?.toUpperCase()}</Text>
        <Text style={[styles.headline, { color: colors.foreground, fontFamily: 'Inter_900Black', fontSize: 36, letterSpacing: -1.5, lineHeight: 40 }]}>What will you master today?</Text>
      </View>
      {error ? <Text style={[styles.accountError, { color: colors.destructive }]}>{error}</Text> : null}

      <SectionHeading title="Get unstuck now" />
      <HelpTypeGrid onSelect={(item) => router.push({ pathname: '/request', params: { helpType: item.id, serviceType: item.serviceType, ...(item.learningPath ? { learningPath: item.learningPath } : {}) } })} />
      <View style={[styles.requestPromptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
          <View style={{ alignItems: 'center', backgroundColor: colors.leaf, borderRadius: 12, height: 36, justifyContent: 'center', width: 36 }}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Need help phrasing it?</Text><Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 }}>Type a few words — we'll shape your request for you.</Text></View>
        </View>
        <View style={[styles.requestPromptInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput value={requestPrompt} onChangeText={setRequestPrompt} placeholder="I’m stuck on…" placeholderTextColor={colors.mutedForeground} style={{ color: colors.foreground, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 42 }} returnKeyType="go" onSubmitEditing={() => void startWithPrompt()} accessibilityLabel="Describe what you need help with" />
          <HapticPressable accessibilityRole="button" accessibilityLabel="Help write my request" disabled={requestPrompt.trim().length < 3 || assistingPrompt} onPress={() => void startWithPrompt()} style={({ pressed }) => [styles.searchButton, { backgroundColor: colors.primary, opacity: requestPrompt.trim().length < 3 || assistingPrompt ? 0.45 : pressed ? 0.75 : 1 }]}><Ionicons name={assistingPrompt ? 'hourglass-outline' : 'arrow-forward'} size={16} color={colors.primaryForeground} /></HapticPressable>
        </View>
      </View>
      {suggestedTutors.length ? <>
        <SectionHeading title="Tutors to explore" action="Browse all" onAction={() => router.push('/(tabs)/find')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
          {suggestedTutors.map((tutor) => {
            const initials = tutor.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
            return <HapticPressable key={tutor.id} accessibilityRole="button" onPress={() => router.push(`/tutor/${tutor.id}` as never)} style={({ pressed }) => [styles.suggestedTutorCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
                <View style={{ alignItems: 'center', backgroundColor: colors.leaf, borderRadius: 18, height: 42, justifyContent: 'center', width: 42 }}><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{initials}</Text></View>
                <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{tutor.displayName}</Text><Text numberOfLines={1} style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 }}>{tutor.subjects.slice(0, 2).join(' · ')}</Text></View>
              </View>
              <View style={{ borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 9 }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12 }}>${(tutor.hourlyRateCents / 100).toFixed(0)} / hour</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 10 }}>{tutor.reviewCount ? `★ ${tutor.averageRating.toFixed(1)} · ${tutor.reviewCount}` : 'New tutor'}</Text>
              </View>
            </HapticPressable>;
          })}
        </ScrollView>
      </> : null}
      <HapticPressable accessibilityRole="button" onPress={() => router.push('/(tabs)/find')} style={({ pressed }) => [{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Browse tutors instead  →</Text>
      </HapticPressable>

      {/* Next session */}
      <SectionHeading title="Your next session" action="All sessions" onAction={() => router.push('/(tabs)/activity')} />
      {upcoming ? (
        <HapticPressable accessibilityRole="button" onPress={() => router.push(`/workroom/${upcoming.id}` as never)} style={[styles.accountSessionCard, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 }]}>
          <View style={[styles.accountSessionIcon, { backgroundColor: colors.leaf }]}><Ionicons name="flash" size={19} color={colors.primary} /></View>
          <View style={styles.accountSessionCopy}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.accountSessionTitle, { color: colors.foreground }]}>{upcoming.subject} · {upcoming.title}</Text>
              {upcoming.status === 'in_progress' ? <View style={[styles.liveTag, { backgroundColor: colors.liveEmeraldLight }]}><Text style={{ color: colors.liveEmerald, fontSize: 10, fontFamily: 'Inter_700Bold' }}>IN SESSION</Text></View> : null}
            </View>
            <Text style={[styles.accountSessionMeta, { color: colors.mutedForeground }]}>With {upcoming.tutorName} · Open your session space</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </HapticPressable>
      ) : loading ? <HomeSkeleton /> : (
        <EmptyState
          icon="document-text-outline"
          title="No sessions yet"
          description="Browse tutors by subject or create a request to receive offers."
          action="Find a tutor"
          onAction={() => router.push('/request')}
        />
      )}

      {requestCount > 0 ? <HapticPressable accessibilityRole="button" onPress={() => router.push('/(tabs)/activity')} style={[styles.activityNudge, { backgroundColor: colors.pale }]}>
        <View style={{ flex: 1 }}><Text style={[styles.activityNudgeLabel, { color: colors.primary }]}>YOUR LEARNING</Text><Text style={[styles.activityNudgeTitle, { color: colors.foreground }]}>{requestCount} open {requestCount === 1 ? 'request' : 'requests'}</Text><Text style={[styles.activityNudgeMeta, { color: colors.mutedForeground }]}>See tutor replies and session notes</Text></View>
        <Ionicons name="arrow-forward" size={18} color={colors.primary} />
      </HapticPressable> : null}

      {notifications.length ? <>
        <SectionHeading title="A few updates" action="View sessions" onAction={() => router.push('/(tabs)/activity')} />
        {notifications.slice(0, 2).map((item) => <HapticPressable key={item.id} accessibilityRole="button" onPress={() => void openNotification(item)} style={[styles.accountNotification, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name={item.readAt ? 'checkmark-circle-outline' : 'sparkles-outline'} size={17} color={colors.primary} /><View style={styles.accountSessionCopy}><Text style={[styles.accountSessionTitle, { color: colors.foreground }]}>{item.title}</Text><Text numberOfLines={2} style={[styles.accountSessionMeta, { color: colors.mutedForeground }]}>{item.body}</Text></View></HapticPressable>)}
      </> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  accountCountPill: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  accountCountText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  accountIntro: { marginBottom: 18, marginTop: 14 },
  accountHero: { borderRadius: 24, gap: 12, padding: 20, shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  accountHeroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3, opacity: 0.8 },
  accountHeroTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.7, lineHeight: 32, maxWidth: 340 },
  accountHeroBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, maxWidth: 340, opacity: 0.88 },
  accountSessionCard: { alignItems: 'center', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, padding: 14, shadowColor: '#183B31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  accountSessionIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  accountSessionCopy: { flex: 1, gap: 4 },
  accountSessionTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18, letterSpacing: -0.2 },
  accountSessionMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  accountProgressCard: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 12, padding: 14 },
  accountProgressIcon: { alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  accountReviewCard: { borderRadius: 22, gap: 11, marginTop: 14, padding: 18 },
  accountNotification: { alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 11, marginBottom: 9, padding: 13 },
  accountError: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, marginVertical: 8 },
  profileButton: { alignItems: 'center', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  intro: { marginBottom: 20, marginTop: 18 },
  headline: { fontFamily: 'Georgia', fontSize: 34, letterSpacing: -1.1, lineHeight: 40, marginTop: 12, maxWidth: 330 },
  subhead: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 320 },
  publicHero: { borderRadius: 28, gap: 16, justifyContent: 'center', marginTop: 4, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 28, position: 'relative' },
  publicHeroOrbit: { borderColor: 'rgba(255,248,235,0.14)', borderRadius: 160, borderWidth: 1, height: 280, position: 'absolute', right: -100, top: -140, width: 280 },
  publicHeroOrbit2: { backgroundColor: 'rgba(212,165,116,0.12)', borderRadius: 200, height: 320, position: 'absolute', left: -120, bottom: -160, width: 320 },
  publicHeroHeading: { gap: 8 },
  publicHeroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  publicHeroTitle: { fontFamily: 'Inter_900Black', fontSize: 42, letterSpacing: -1.5, lineHeight: 46 },
  publicHeroSub: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 4 },
  publicSearch: { marginBottom: 0, borderRadius: 16, minHeight: 52, paddingVertical: 6 },
  publicHeroCtaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  publicHeroCta: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  publicHeroCtaText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  publicHeroCtaSecondary: { alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 14 },
  publicHeroCtaSecondaryText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  activityNudge: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', marginTop: 18, padding: 17 },
  activityNudgeLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  activityNudgeTitle: { fontFamily: 'Georgia', fontSize: 20, marginTop: 4 },
  activityNudgeMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4 },
  hero: { flexDirection: 'row', minHeight: 256, padding: 20, position: 'relative', borderRadius: 24 },
  heroCopy: { flex: 1, maxWidth: '62%', zIndex: 2 },
  heroTag: { alignSelf: 'flex-start', borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  heroTagText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.2 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.7, lineHeight: 30, marginTop: 16 },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 8, opacity: 0.88 },
  heroButton: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 8, marginTop: 18, paddingHorizontal: 14, paddingVertical: 10 },
  heroButtonText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  heroImageFrame: { bottom: 0, height: 200, position: 'absolute', right: 7, width: 156, zIndex: 1 },
  heroImage: { borderTopLeftRadius: 84, borderTopRightRadius: 84, bottom: 0, height: 190, position: 'absolute', right: 0, width: 132 },
  imageAccent: { borderRadius: 99, height: 20, position: 'absolute', right: 118, top: 26, width: 20 },
  heroMiniCard: { alignItems: 'center', borderRadius: 12, bottom: 16, flexDirection: 'row', gap: 5, left: -4, paddingHorizontal: 9, paddingVertical: 8, position: 'absolute' },
  heroMiniText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  heroDecoration: { borderRadius: 99, borderWidth: 1, height: 170, opacity: 0.12, position: 'absolute', right: -50, top: -45, width: 170 },
  firstStep: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 14, padding: 14 },
  firstStepIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  firstStepCopy: { flex: 1 },
  firstStepTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: -0.2 },
  firstStepDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 4 },
  addButton: { alignItems: 'center', borderRadius: 13, height: 36, justifyContent: 'center', width: 36 },
  nextSession: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 14, padding: 14 },
  nextIcon: { alignItems: 'center', borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
  nextCopy: { flex: 1 },
  nextLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  nextTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 4, letterSpacing: -0.2 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  requestCard: { borderRadius: 22, borderWidth: 1, gap: 10, marginTop: 16, padding: 17, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  requestIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  requestTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  requestCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 2 },
  tutorHero: { padding: 20, borderRadius: 24 },
  tutorHeroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tutorHeroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, opacity: 0.8 },
  tutorHeroName: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.7, marginTop: 8 },
  tutorHeroSubject: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4, opacity: 0.86 },
  tutorHeroPortrait: { borderRadius: 22, height: 116, overflow: 'hidden', width: 96 },
  tutorHeroImage: { height: '100%', width: '100%' },
  tutorStatLine: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 13 },
  tutorStatValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  tutorStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 3, opacity: 0.75 },
  requestArrow: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  tutorRequestRow: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 11, marginBottom: 9, padding: 12 },
  requestText: { flex: 1 },
  requestSubject: { fontFamily: 'Inter_700Bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase' },
  requestRowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 15 },
  exampleNote: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 5 },
  tutorCallout: { alignItems: 'flex-start', borderRadius: 18, flexDirection: 'row', gap: 11, marginTop: 14, padding: 14 },
  tutorCalloutCopy: { flex: 1 },
  tutorCalloutTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  tutorCalloutText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 4 },
  roleSwitchBtn: { alignItems: 'center', borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  roleSwitchBtnText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.1 },
  tutorStudioBadge: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.2, textTransform: 'uppercase' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  kpiCard: { borderRadius: 18, borderWidth: 1, flexBasis: '47%', flexGrow: 1, padding: 14, shadowColor: '#183B31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  kpiLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  kpiValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 4 },
  kpiSub: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 4 },
  directInquiryCard: { borderRadius: 20, borderWidth: 1.5, gap: 12, marginBottom: 12, padding: 16, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  directInquiryTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  directInquiryIcon: { alignItems: 'center', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  directInquiryLearner: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  directInquiryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 2 },
  directInquiryBudget: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  directInquiryBudgetText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  quietCard: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 12, marginBottom: 14, padding: 14 },
  quietCardText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  searchWrap: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#1B4332', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  requestPromptCard: { borderRadius: 18, borderWidth: 1, gap: 10, marginTop: 8, padding: 13 },
  requestPromptInput: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 5 },
  suggestedTutorCard: { borderRadius: 18, borderWidth: 1, padding: 12, width: 268 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Inter_400Regular', fontSize: 14 },
  searchButton: { alignItems: 'center', backgroundColor: '#1B4332', borderRadius: 12, height: 32, justifyContent: 'center', width: 32 },
  categoryRow: { gap: 10, paddingBottom: 6, paddingRight: 4 },
  categoryCard: { alignItems: 'center', borderRadius: 20, borderWidth: 1, gap: 10, paddingHorizontal: 16, paddingVertical: 16, width: 116, shadowColor: '#1B4332', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  categoryIcon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  categoryLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, textAlign: 'center', letterSpacing: 0.2 },
  urgencyPulseBadge: { alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  pulseDot: { width: 7, height: 7, borderRadius: 4 },
  urgencyPulseText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricTicker: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8, marginBottom: 14 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  metricLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 2 },
  metricDivider: { width: 1, height: 28 },
  liveTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
});

