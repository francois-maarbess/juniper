import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Platform } from 'react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { FilterSheet } from '@/components/sheets/FilterSheet';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SAMPLE_TUTORS, SUBJECTS, EXAMPLE_REQUESTS, LEARNING_PATHS, getLearningPathForSubject, subjectsForLearningPath, type LearningPathId } from '@/constants/juniper-data';
import { LearningPathPicker } from '@/components/LearningPathPicker';
import { useJuniper } from '@/context/JuniperContext';
import {
  ActionButton,
  EmptyState,
  PageHeader,
  Pill,
  PreviewNotice,
  Screen,
  SectionHeading,
  StatusPill,
} from '@/components/JuniperUI';
import { TutorBundleCreator, type OfferType } from '@/components/TutorBundleCreator';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HELP_TYPES } from '@/components/HelpTypeGrid';

export default function FindScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; level?: string; query?: string; category?: string; learningPath?: string; requestId?: string }>();
  const { state, sendOffer, toggleSavedTutor } = useJuniper();
  const { user, request, download } = useAuth();
  const activeRole = user?.activeRole ?? (__DEV__ ? state.role : 'student');
  const [realTutors, setRealTutors] = useState<Array<{
      id: string; displayName: string; headline: string | null; biography: string | null;
      hourlyRateCents: number; subjects: string[]; availability: string[];
      languages?: string[];
      customSubjects?: string[]; customCourses?: string[]; customUniversities?: string[];
      averageRating: number; reviewCount: number; completedSessions: number; timezone: string; responseTimeMinutes: number | null; responseSampleCount: number; levels: string[];
      courses?: Array<{ id: string; university: string; code: string; name: string }>;
  }>>([]);
  const [tutorsLoading, setTutorsLoading] = useState(false);
  const [tutorsError, setTutorsError] = useState('');
  const [liveRequests, setLiveRequests] = useState<Array<{
    id: string; learner: string; subject: string; title: string; details: string; deadline: string; budget: number; example: boolean; offerSent?: boolean; level?: string | null; customCourse?: string | null; university?: string | null; instructionLanguage?: string | null; helpType?: string;
    preferredTimes?: string[]; sessionDurationMinutes?: number; timezone?: string;
    isDirect?: boolean; targetTutorId?: string | null;
    attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>;
  }> | null>(null);
  const [tutorWorkload, setTutorWorkload] = useState<{ activeSessions: number; sessionsToArrange: number; hoursNext7Days: number } | null>(null);
  const [boardError, setBoardError] = useState('');
  const [accountTutorProfile, setAccountTutorProfile] = useState<{ displayName: string; subjects: string[] } | null>(null);
  const [query, setQuery] = useState(params.query ?? params.category ?? '');
  const [selectedSubject, setSelectedSubject] = useState(params.subject ?? 'All');
  const initialPath = params.learningPath as LearningPathId | undefined;
  const defaultPath = initialPath ?? (params.subject ? getLearningPathForSubject(params.subject) : 'university');
  const [selectedPath, setSelectedPath] = useState<LearningPathId>(defaultPath);
  const [selectedLevel, setSelectedLevel] = useState(params.level ?? (defaultPath === 'school' ? 'High school' : defaultPath === 'university' ? 'University' : defaultPath === 'professional' ? 'Adult learning' : 'All levels'));
  const [selectedUniversity, setSelectedUniversity] = useState('All');
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [activeOfferRequest, setActiveOfferRequest] = useState<string | null>(null);
  const filterSheetRef = useRef<{ present: () => void; dismiss: () => void } | null>(null);
  const [offerPrice, setOfferPrice] = useState('28');
  const [offerNote, setOfferNote] = useState('I can help you work through this step by step.');
  const [offerDate, setOfferDate] = useState('');
  const [offerTime, setOfferTime] = useState('');
  const [message, setMessage] = useState('');

  const tutors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const courseCodeFilter = selectedCourseCode.trim().toLowerCase();
    return realTutors.filter((tutor) => {
      const tutorCoursesStr = [...(tutor.courses ?? []).map((c) => `${c.university} ${c.code} ${c.name}`), ...(tutor.customCourses ?? []), ...(tutor.customUniversities ?? [])].join(' ').toLowerCase();
      const tutorSubjects = [...tutor.subjects, ...(tutor.customSubjects ?? [])];
      const matchesSearch = !normalized || `${tutor.displayName} ${tutor.headline ?? ''} ${tutor.biography ?? ''} ${tutorSubjects.join(' ')} ${(tutor.languages ?? []).join(' ')} ${tutorCoursesStr}`.toLowerCase().includes(normalized);
      const pathSubjects = new Set(subjectsForLearningPath(selectedPath, SUBJECTS).map((item) => item.name.toLowerCase()));
      const matchesPath = selectedPath === 'university' || selectedPath === 'school' || selectedPath === 'exams' || selectedPath === 'other'
        ? true
        : tutorSubjects.some((value) => pathSubjects.has(value.toLowerCase())) || Boolean(tutor.customSubjects?.length);
      const matchesSubject = (selectedSubject === 'All' || tutorSubjects.includes(selectedSubject)) && matchesPath;
      const matchesUni = selectedUniversity === 'All' || (tutor.courses ?? []).some((c) => c.university.toLowerCase() === selectedUniversity.toLowerCase()) || (tutor.customUniversities ?? []).some((value) => value.toLowerCase() === selectedUniversity.toLowerCase());
      const matchesCourse = !courseCodeFilter || (tutor.courses ?? []).some((c) => `${c.code} ${c.name}`.toLowerCase().includes(courseCodeFilter)) || (tutor.customCourses ?? []).some((value) => value.toLowerCase().includes(courseCodeFilter));
      return matchesSearch && matchesSubject && matchesUni && matchesCourse;
    });
  }, [realTutors, query, selectedSubject, selectedUniversity, selectedCourseCode, selectedPath]);

  useEffect(() => {
    if (activeRole !== 'student') return;
    let active = true;
    setTutorsLoading(true);
    const filters = new URLSearchParams();
    if (selectedSubject !== 'All') filters.set('subject', selectedSubject);
    if (selectedLevel !== 'All levels') filters.set('level', selectedLevel);
    if (selectedUniversity !== 'All') filters.set('university', selectedUniversity);
    if (selectedCourseCode) filters.set('courseCode', selectedCourseCode);
    const filterQuery = filters.toString();
    void request<Array<{
      id: string; displayName: string; headline: string | null; biography: string | null;
      hourlyRateCents: number; availability: string[]; subject: string; timezone: string; responseTimeMinutes: number | null; responseSampleCount: number; levels: string[];
      customSubjects?: string[]; customCourses?: string[]; customUniversities?: string[];
      languages?: string[];
      averageRating: number; reviewCount: number; completedSessions: number;
      courses?: Array<{ id: string; university: string; code: string; name: string }>;
    }>>(`/marketplace/tutors${filterQuery ? `?${filterQuery}` : ''}`).then((rows) => {
      if (!active) return;
      const byId = new Map<string, (typeof realTutors)[number]>();
      for (const row of rows) {
        const current: (typeof realTutors)[number] = byId.get(row.id) ?? {
          id: row.id, displayName: row.displayName, headline: row.headline, biography: row.biography,
          hourlyRateCents: row.hourlyRateCents, subjects: [], availability: row.availability,
          averageRating: row.averageRating, reviewCount: row.reviewCount, completedSessions: row.completedSessions,
          timezone: row.timezone, responseTimeMinutes: row.responseTimeMinutes, responseSampleCount: row.responseSampleCount,
          levels: row.levels,
          courses: row.courses ?? [],
          customSubjects: row.customSubjects ?? [], customCourses: row.customCourses ?? [], customUniversities: row.customUniversities ?? [],
          languages: row.languages ?? [],
        };
        if (!current.subjects.includes(row.subject)) current.subjects.push(row.subject);
        for (const customSubject of row.customSubjects ?? []) if (!current.subjects.includes(customSubject)) current.subjects.push(customSubject);
        byId.set(row.id, current);
      }
      setRealTutors([...byId.values()]);
      setTutorsError('');
    }).catch((error: unknown) => {
      if (active) setTutorsError(error instanceof Error ? error.message : 'Approved tutor profiles could not be loaded.');
    }).finally(() => { if (active) setTutorsLoading(false); });
    return () => { active = false; };
  }, [user, activeRole, request, selectedSubject, selectedLevel, selectedUniversity, selectedCourseCode]);

  useEffect(() => {
    if (activeRole !== 'tutor' || !user) return;
    let active = true;
    void Promise.all([request<Array<{
      id: string; learnerDisplayName: string; subject: string; level?: string | null; customSubject?: string | null; customCourse?: string | null; university?: string | null; instructionLanguage?: string | null; title: string; details: string; deadline: string; budgetCents: number; hasOffered: boolean; ownOfferId?: string | null; helpType?: string;
      preferredTimes: string[]; sessionDurationMinutes: number; timezone: string;
      isDirect?: boolean; targetTutorId?: string | null;
      serviceType?: string;
      attachments: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>;
    }>>('/marketplace/requests/board'), request<{
      displayName: string; subjects: Array<{ name: string }>;
    } | null>('/marketplace/tutor-profile'), request<{
      activeSessions: number; sessionsToArrange: number; hoursNext7Days: number;
    }>('/marketplace/tutor/workload')]).then(([items, profile, workload]) => {
      if (!active) return;
      setAccountTutorProfile(profile ? { displayName: profile.displayName, subjects: profile.subjects.map((item) => item.name) } : null);
      setTutorWorkload(workload);
      setLiveRequests(items.map((item) => ({
        id: item.id, learner: item.learnerDisplayName, subject: item.customSubject || item.subject, level: item.level, customCourse: item.customCourse, university: item.university, instructionLanguage: item.instructionLanguage, title: item.title,
        details: item.details, deadline: new Date(item.deadline).toLocaleDateString(),
        budget: item.budgetCents / 100, example: false, offerSent: item.hasOffered, ownOfferId: item.ownOfferId ?? undefined,
        preferredTimes: item.preferredTimes, sessionDurationMinutes: item.sessionDurationMinutes, timezone: item.timezone,
        isDirect: Boolean(item.isDirect), targetTutorId: item.targetTutorId,
        serviceType: item.serviceType ?? 'assignment_project',
        helpType: item.helpType,
        attachments: item.attachments ?? [],
      })));
      setBoardError('');
    }).catch((caught: unknown) => {
      if (active) { setLiveRequests([]); setBoardError(caught instanceof Error ? caught.message : 'Tutor review is needed before you can see requests.'); }
    });
    return () => { active = false; };
  }, [activeRole, user, request]);

  const tutorRequests = user
      ? (liveRequests ?? [])
      : __DEV__ && state.role === 'tutor'
      ? [
          ...state.requests.map((request) => ({
            ...request,
            learner: 'Juniper learner',
            example: false,
            offerSent: false,
          })),
          ...EXAMPLE_REQUESTS.filter(
            (example) => !state.requests.some((request) => request.id === example.id),
          ).map((example) => ({ ...example, example: true })),
        ]
      : [];

  useEffect(() => {
    if (activeRole === 'tutor' && params.requestId && tutorRequests.some((item) => item.id === params.requestId)) {
      setActiveOfferRequest(params.requestId);
    }
  }, [activeRole, params.requestId, tutorRequests]);

  const submitOffer = async (
    requestId: string,
    extra?: {
      includesWalkthrough?: boolean;
      offerType?: 'hourly' | 'package';
      packageSessionCount?: number;
      packageDescription?: string;
    }
  ) => {
    const price = Number(offerPrice);
    if (!Number.isFinite(price) || price < 5 || price > 500) {
      setMessage('Enter a session or bundle price between $5 and $500.');
      return;
    }
    if (user) {
      try {
        const dateText = offerDate.trim();
        const timeText = offerTime.trim();
        if (Boolean(dateText) !== Boolean(timeText)) {
          setMessage('Add both a date and a time, or leave both blank to arrange the time in chat.');
          return;
        }
        const proposed = dateText ? new Date(`${dateText}T${timeText}`) : null;
        if (proposed && (!Number.isFinite(proposed.getTime()) || proposed.getTime() < Date.now() + 15 * 60_000)) {
          setMessage('Choose a session time at least 15 minutes from now.');
          return;
        }
        const savedOffer = await request<{ id: string }>(`/marketplace/requests/${requestId}/offers`, {
          body: {
            amountCents: Math.round(price * 100),
            note: offerNote.trim() || 'I would be glad to help.',
            includesWalkthrough: extra?.includesWalkthrough ?? true,
            ...(proposed ? { proposedAt: proposed.toISOString() } : {}),
            ...(extra?.offerType ? { offerType: extra.offerType } : {}),
            ...(extra?.packageSessionCount ? { packageSessionCount: extra.packageSessionCount } : {}),
            ...(extra?.packageDescription ? { packageDescription: extra.packageDescription } : {}),
          },
        });
        setMessage('Your offer has been sent to the learner.');
        setActiveOfferRequest(null);
        setLiveRequests((items) => (items ?? []).map((item) => item.id === requestId
          ? { ...item, offerSent: true, ownOfferId: savedOffer.id }
          : item));
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'We couldn’t send your offer. Please try again.');
      }
      return;
    }
    sendOffer(requestId, price, offerNote.trim() || 'I would be glad to help.');
    setMessage('Offer saved to this preview.');
    setActiveOfferRequest(null);
  };

  if (activeRole === 'tutor') {
    if (!user && !__DEV__) return <Screen><PageHeader title="Teach with Juniper" eyebrow="Tutor studio" /><EmptyState icon="school-outline" title="Build your teaching profile" description="Create an account, share your qualifications, and our team will review your application before you can respond to learners." action="Sign in or join" onAction={() => router.push('/(auth)/welcome')} /></Screen>;
    return (
      <TutorRequestBoard
        requests={tutorRequests}
        activeOfferRequest={activeOfferRequest}
        setActiveOfferRequest={setActiveOfferRequest}
        offerPrice={offerPrice}
        setOfferPrice={setOfferPrice}
        offerNote={offerNote}
        setOfferNote={setOfferNote}
        offerDate={offerDate}
        setOfferDate={setOfferDate}
        offerTime={offerTime}
        setOfferTime={setOfferTime}
        submitOffer={submitOffer}
        message={message || boardError || (!liveRequests && user ? 'Loading approved requests…' : '')}
        accountTutor={Boolean(user)}
        accountTutorName={accountTutorProfile?.displayName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        accountTutorSubjects={accountTutorProfile?.subjects.join(' · ') ?? ''}
        tutorWorkload={tutorWorkload}
        userId={user?.id ?? ''}
        selectedSubject={selectedSubject}
        selectedLevel={selectedLevel}
        download={download}
        request={request}
      />
    );
  }

  return (
    <>
    <Screen>
      <PageHeader title="Find a tutor" eyebrow="Explore by subject and fit" />
      {!user && __DEV__ ? <PreviewNotice message="Browse real tutor profiles here. Sign in or join Juniper to send a request or arrange a session." /> : null}
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search-outline" size={19} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Subject, course, language, tutor"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search tutors and subjects"
          testID="tutor-search"
        />
        {query ? (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </HapticPressable>
        ) : null}
      </View>
      <Text style={[styles.pathLabel, { color: colors.mutedForeground }]}>BROWSE BY LEARNING AREA</Text>
      <LearningPathPicker
        selected={selectedPath}
        onChange={(path) => {
          setSelectedPath(path);
          setSelectedSubject('All');
          setSelectedUniversity('All');
          setSelectedCourseCode('');
          setSelectedLevel(path === 'school' ? 'High school' : path === 'university' ? 'University' : path === 'professional' ? 'Adult learning' : 'All levels');
        }}
      />
      <Text style={[styles.pathHint, { color: colors.mutedForeground }]}>
        {LEARNING_PATHS.find((path) => path.id === selectedPath)?.description}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {['All', ...subjectsForLearningPath(selectedPath, SUBJECTS).slice(0, 7).map((subject) => subject.name)].map((subject) => (
          <Pill
            key={subject}
            label={subject}
            selected={selectedSubject === subject}
            onPress={() => setSelectedSubject(subject)}
          />
        ))}
      </ScrollView>

      <HapticPressable
        onPress={() => filterSheetRef.current?.present()}
        style={[styles.filterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="options-outline" size={16} color={colors.primary} />
        <Text style={[styles.filterButtonText, { color: colors.foreground }]}>Filters</Text>
        {(selectedUniversity !== 'All' || selectedCourseCode || selectedLevel !== 'All levels') ? (
          <View style={[styles.filterBadge, { backgroundColor: colors.primary }]} />
        ) : null}
      </HapticPressable>
      <SectionHeading
        title={`${tutors.length} tutors to explore`}
        action="Post a request"
        onAction={() => router.push('/request')}
      />
      <>
        {tutorsError ? <Text style={[styles.inlineMessage, { color: colors.destructive }]}>{tutorsError}</Text> : null}
        {tutorsLoading ? <Text style={[styles.realTutorMeta, { color: colors.mutedForeground }]}>Finding thoughtful tutors…</Text> : null}
        {!tutorsLoading && tutors.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={selectedSubject === 'All' ? 'No tutors for this search yet' : `No ${selectedSubject} tutors yet`}
            description="Send a request for your course or topic. Tutors can reply with an offer."
            action="Create a tutoring request"
            onAction={() => router.push({ pathname: '/request', params: { learningPath: selectedPath, ...(selectedSubject === 'All' ? {} : { subject: selectedSubject }) } })}
          />
        ) : null}
        {tutors.map((tutor) => (
          <View key={tutor.id} style={[styles.realTutorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.realTutorTop}>
              <View style={[styles.realTutorAvatar, { backgroundColor: colors.leaf }]}><Ionicons name="school-outline" size={20} color={colors.primary} /></View>
              <View style={styles.realTutorIdentity}><Text style={[styles.realTutorName, { color: colors.foreground }]}>{tutor.displayName}</Text><Text style={[styles.realTutorMeta, { color: colors.mutedForeground }]}>{tutor.headline ?? tutor.subjects.join(' · ')}</Text></View>
              <View style={[styles.approvedBadge, { backgroundColor: colors.leaf }]}><Ionicons name="checkmark-circle" size={13} color={colors.primary} /><Text style={[styles.approvedText, { color: colors.primary }]}>Approved</Text></View>
            </View>
            {tutor.biography ? <Text numberOfLines={3} style={[styles.realTutorBio, { color: colors.mutedForeground }]}>{tutor.biography}</Text> : null}
            {tutor.reviewCount ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="star" size={13} color="#D97706" />
                <Text style={[styles.realTutorMeta, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {Number(tutor.averageRating).toFixed(1)}
                </Text>
                <Text style={[styles.realTutorMeta, { color: colors.mutedForeground }]}>
                  · {tutor.reviewCount} reviews · {tutor.completedSessions} sessions completed
                </Text>
              </View>
            ) : (
              <Text style={[styles.realTutorMeta, { color: colors.mutedForeground }]}>
                Newly approved tutor · Subjects listed below
              </Text>
            )}
            <View style={[styles.fitPanel, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.fitHeading, { color: colors.primary }]}>Why this could fit</Text>
              <View style={styles.fitLine}><Ionicons name="checkmark-circle" size={14} color={colors.primary} /><Text style={[styles.fitText, { color: colors.foreground }]}>{selectedSubject !== 'All'
                ? `Teaches ${selectedSubject}`
                : `Teaches ${tutor.subjects.slice(0, 3).join(' · ')}`}</Text></View>
              <View style={styles.fitLine}><Ionicons name="checkmark-circle" size={14} color={colors.primary} /><Text style={[styles.fitText, { color: colors.foreground }]}>{selectedLevel !== 'All levels'
                ? (tutor.levels.includes('all') ? 'Welcomes every learner level' : `Supports ${selectedLevel}`)
                : (tutor.levels.includes('all') ? 'Welcomes every learner level' : `Supports ${tutor.levels.slice(0, 3).join(' · ')}`)}</Text></View>
              <View style={styles.fitLine}><Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} /><Text style={[styles.fitText, { color: colors.foreground }]}>Profile and qualifications reviewed by Juniper</Text></View>
              <View style={styles.fitLine}><Ionicons name="time-outline" size={14} color={colors.primary} /><Text style={[styles.fitText, { color: colors.foreground }]}>{tutor.responseSampleCount >= 3 && tutor.responseTimeMinutes !== null
                ? `Typically sends a first offer in about ${Math.max(1, Math.round(tutor.responseTimeMinutes / 60))}h · ${tutor.responseSampleCount} recent requests`
                : 'New reply history · response timing will appear as they build a track record'}</Text></View>
            </View>
            {tutor.courses && tutor.courses.length > 0 ? (
              <View style={styles.tutorCoursesRow}>
                <View style={styles.tutorCoursesLabelWrap}>
                  <Ionicons name="school-outline" size={12} color={colors.primary} />
                  <Text style={[styles.tutorCoursesLabel, { color: colors.mutedForeground }]}>
                    COURSE EXPERIENCE ({tutor.courses.length})
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {tutor.courses.map((course) => (
                    <View
                      key={course.id}
                      style={[styles.tutorCoursePill, { backgroundColor: colors.leaf, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.tutorCourseUni, { color: colors.primary }]}>{course.university}</Text>
                      <Text style={[styles.tutorCourseCode, { color: colors.foreground }]}>{course.code}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.realTutorFooter}>
              <Text style={[styles.realTutorMeta, { color: colors.mutedForeground }]}>{tutor.subjects.join(' · ')}</Text>
              <Text style={[styles.realTutorRate, { color: colors.primary }]}>${(tutor.hourlyRateCents / 100).toFixed(0)} / hour</Text>
            </View>
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel={`View ${tutor.displayName}'s full tutor profile`}
              onPress={() => router.push(`/tutor/${tutor.id}` as never)}
              style={({ pressed }) => [styles.viewProfileButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="person-circle-outline" size={17} color={colors.primary} />
              <Text style={[styles.viewProfileText, { color: colors.primary }]}>View full profile</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </HapticPressable>
            <ActionButton
              label={`Request a session with ${tutor.displayName.split(' ')[0]}`}
              icon="calendar-outline"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/request',
                  params: {
                    tutorId: tutor.id,
                    tutorName: tutor.displayName,
                    subject: tutor.subjects[0] ?? 'Computer science',
                  },
                })
              }
            />
          </View>
        ))}
        {realTutors.length ? <View style={{ height: 4 }} /> : null}
      </>
      {!user ? <View style={styles.bottomPrompt}>
        <Text style={[styles.promptTitle, { color: colors.foreground }]}>
          Not sure who to choose?
        </Text>
        <Text style={[styles.promptCopy, { color: colors.mutedForeground }]}>
          Share the subject, your preferred timeframe, and a comfortable budget. Tutors can reply with a clear session offer.
        </Text>
        <ActionButton
          label="Ask for offers"
          icon="arrow-forward"
          onPress={() => router.push('/request')}
          variant="secondary"
        />
      </View> : null}
    </Screen>
    <FilterSheet
      ref={filterSheetRef}
      selectedUniversity={selectedUniversity}
      setSelectedUniversity={setSelectedUniversity}
      selectedCourseCode={selectedCourseCode}
      setSelectedCourseCode={setSelectedCourseCode}
      selectedLevel={selectedLevel}
      setSelectedLevel={setSelectedLevel}
      universities={[...new Set(realTutors.flatMap((tutor) => [...(tutor.courses ?? []).map((course) => course.university), ...(tutor.customUniversities ?? [])]))]}
    />
  </>
  );
}

function TutorRequestBoard({
  requests,
  activeOfferRequest,
  setActiveOfferRequest,
  offerPrice,
  setOfferPrice,
  offerNote,
  setOfferNote,
  offerDate,
  setOfferDate,
  offerTime,
  setOfferTime,
  submitOffer,
  message,
  accountTutor,
  accountTutorName,
  accountTutorSubjects,
  tutorWorkload,
  userId,
  selectedSubject,
  selectedLevel,
  download,
  request: apiRequest,
}: {
  requests: Array<{
    id: string;
    learner: string;
    subject: string;
    title: string;
    details: string;
    deadline: string;
    budget: number;
    example: boolean;
    offerSent?: boolean;
    ownOfferId?: string;
    level?: string | null;
    customCourse?: string | null;
    university?: string | null;
    instructionLanguage?: string | null;
    preferredTimes?: string[];
    sessionDurationMinutes?: number;
    timezone?: string;
    isDirect?: boolean;
    serviceType?: string;
    helpType?: string;
    attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>;
  }>;
  activeOfferRequest: string | null;
  setActiveOfferRequest: (id: string | null) => void;
  offerPrice: string;
  setOfferPrice: (value: string) => void;
  offerNote: string;
  setOfferNote: (value: string) => void;
  offerDate: string;
  setOfferDate: (value: string) => void;
  offerTime: string;
  setOfferTime: (value: string) => void;
  submitOffer: (
    id: string,
    extra?: {
      includesWalkthrough?: boolean;
      offerType?: 'hourly' | 'package';
      packageSessionCount?: number;
      packageDescription?: string;
    }
  ) => void;
  message: string;
  accountTutor: boolean;
  accountTutorName: string;
  accountTutorSubjects: string;
  tutorWorkload: { activeSessions: number; sessionsToArrange: number; hoursNext7Days: number } | null;
  userId: string;
  selectedSubject: string;
  selectedLevel: string;
  download: (path: string) => Promise<{ blob: Blob; fileName: string }>;
  request: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
}) {
  const colors = useColors();
  const { state } = useJuniper();
  const { setActiveRole } = useAuth();
  const offerSheetRef = useRef<BottomSheetModal>(null);
  const activeRequest = requests.find((item) => item.id === activeOfferRequest) ?? null;
  const [boardFilter, setBoardFilter] = useState<'highest_budget' | 'direct' | 'open' | 'all'>('all');
  const [includesWalkthrough, setIncludesWalkthrough] = useState<boolean>(true);
  const [offerType, setOfferType] = useState<OfferType>('hourly');
  const [sessionCount, setSessionCount] = useState<number>(4);
  const [packageDescription, setPackageDescription] = useState<string>('');
  const [fileError, setFileError] = useState('');
  const [openChatRequest, setOpenChatRequest] = useState<string | null>(null);
  const [boardMessages, setBoardMessages] = useState<Record<string, Array<{ id: string; senderId: string; text: string; createdAt: string }>>>({});
  const [boardDraft, setBoardDraft] = useState('');
  const [sendingBoardMessage, setSendingBoardMessage] = useState(false);
  const [guidance, setGuidance] = useState<Record<string, { loading?: boolean; sampleCount?: number; lowCents?: number | null; medianCents?: number | null; highCents?: number | null; learnerBudgetCents?: number; error?: string }>>({});
  const currentTutor = SAMPLE_TUTORS.find((tutor) => tutor.id === state.tutorProfileId) ?? SAMPLE_TUTORS[0];
  const directCount = requests.filter((r) => r.isDirect).length;
  const filteredRequests = [...requests].sort((a, b) => (boardFilter === 'highest_budget' ? b.budget - a.budget : 0)).filter((r) => {
    if (boardFilter === 'direct') return r.isDirect;
    if (boardFilter === 'open') return !r.isDirect;
    return true;
  });

  const loadGuidance = (requestId: string) => {
    if (!accountTutor || guidance[requestId]) return;
    setGuidance((current) => ({ ...current, [requestId]: { loading: true } }));
    void apiRequest<{ sampleCount: number; lowCents: number | null; medianCents: number | null; highCents: number | null; learnerBudgetCents: number }>(`/marketplace/requests/${requestId}/offer-guidance`)
      .then((result) => setGuidance((current) => ({ ...current, [requestId]: result })))
      .catch((error: unknown) => setGuidance((current) => ({ ...current, [requestId]: { error: error instanceof Error ? error.message : 'Offer guidance is unavailable.' } })));
  };

  const openRequestFile = async (requestId: string, attachment: { id: string; fileName: string }) => {
    try {
      const { blob } = await download(`/marketplace/requests/${requestId}/attachments/${attachment.id}`);
      const safeName = attachment.fileName.replace(/[\\/\0-\x1f]/g, '_').slice(0, 120) || 'learning-file';
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = safeName; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const file = new File(Paths.cache, `${attachment.id}-${safeName}`);
        await file.write(new Uint8Array(await blob.arrayBuffer()));
        await Sharing.shareAsync(file.uri, { dialogTitle: 'Open learner study material' });
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'This study material could not be opened.');
    }
  };

  const toggleLearnerChat = async (item: { id: string; ownOfferId?: string }) => {
    if (!item.ownOfferId) return;
    if (openChatRequest === item.id) { setOpenChatRequest(null); return; }
    setOpenChatRequest(item.id);
    try {
      const items = await apiRequest<Array<{ id: string; senderId: string; text: string; createdAt: string }>>(`/marketplace/requests/${item.id}/offers/${item.ownOfferId}/messages`);
      setBoardMessages((current) => ({ ...current, [item.id]: items }));
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Could not open this conversation.'); }
  };

  const sendLearnerMessage = async (item: { id: string; ownOfferId?: string }) => {
    const text = boardDraft.trim();
    if (!text || !item.ownOfferId || sendingBoardMessage) return;
    setSendingBoardMessage(true);
    try {
      const saved = await apiRequest<{ id: string; senderId: string; text: string; createdAt: string }>(`/marketplace/requests/${item.id}/offers/${item.ownOfferId}/messages`, { method: 'POST', body: { text } });
      setBoardMessages((current) => ({ ...current, [item.id]: [...(current[item.id] ?? []), saved] }));
      setBoardDraft('');
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Message could not be sent.'); }
    finally { setSendingBoardMessage(false); }
  };

  return (
    <>
    <Screen>
      <PageHeader title="Learner requests" eyebrow="Find students to help" />
      <PreviewNotice message={accountTutor ? 'Learner requests are shared from Juniper accounts. Offers go directly to each learner.' : 'Example requests are shown here. Offers stay on this device.'} />
      <View style={[styles.tutorIdentity, { backgroundColor: colors.leaf }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.tutorIdentityLabel, { color: colors.primary }]}>RESPONDING AS</Text>
          {accountTutor ? (
            <HapticPressable
              accessibilityRole="button"
              onPress={() => void setActiveRole('student')}
              style={({ pressed }) => [
                styles.roleSwitchBoardBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
              <Text style={[styles.roleSwitchBoardText, { color: colors.primary }]}>Learner View</Text>
            </HapticPressable>
          ) : null}
        </View>
        <Text style={[styles.tutorIdentityName, { color: colors.foreground }]}>{accountTutor ? accountTutorName || 'Your tutor account' : currentTutor.name}</Text>
        <Text style={[styles.tutorIdentitySubject, { color: colors.mutedForeground }]}>
          {accountTutor ? accountTutorSubjects || 'Tutor profile' : `${currentTutor.subject} · sample tutor profile`}
        </Text>
      </View>
      {accountTutor && tutorWorkload ? (
        <View style={[styles.workloadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.workloadIcon, { backgroundColor: colors.leaf }]}><Ionicons name="calendar-clear-outline" size={17} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.workloadTitle, { color: colors.foreground }]}>Your upcoming workload</Text>
            <Text style={[styles.workloadCopy, { color: colors.mutedForeground }]}>{tutorWorkload.activeSessions} active {tutorWorkload.activeSessions === 1 ? 'session' : 'sessions'} · {tutorWorkload.hoursNext7Days}h scheduled in the next 7 days{tutorWorkload.sessionsToArrange ? ` · ${tutorWorkload.sessionsToArrange} ${tutorWorkload.sessionsToArrange === 1 ? 'time' : 'times'} to arrange` : ''}</Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 4 }}>
        <Pill
          label={`All (${requests.length})`}
          selected={boardFilter === 'all'}
          onPress={() => setBoardFilter('all')}
        />
        {directCount ? (
          <Pill
            label={`For you (${directCount})`}
            icon="sparkles"
            selected={boardFilter === 'direct'}
            onPress={() => setBoardFilter('direct')}
          />
        ) : null}
        <Pill
          label="Open Board"
          selected={boardFilter === 'open'}
          onPress={() => setBoardFilter('open')}
        />
        <Pill
          label="Highest budget"
          selected={boardFilter === 'highest_budget'}
          onPress={() => setBoardFilter('highest_budget')}
        />
      </View>

      <SectionHeading title={boardFilter === 'direct' ? `Direct inquiries (${directCount})` : "Open learner requests"} />
      {fileError ? <Text style={[styles.inlineMessage, { color: colors.destructive }]}>{fileError}</Text> : null}
      {filteredRequests.map((request) => {
        const offerSent = Boolean(request.offerSent) || (!accountTutor && state.offers.some(
          (offer) => offer.requestId === request.id && offer.tutorId === currentTutor.id,
        ));
        return (
          <View
            key={request.id}
            style={[
              styles.requestCard,
              {
                backgroundColor: colors.card,
                borderColor: request.isDirect ? colors.primary : colors.border,
                borderWidth: request.isDirect ? 1.5 : 1,
              },
            ]}
          >
            <View style={styles.requestTopRow}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <StatusPill label={request.subject} tone="green" />
              {request.level && request.level !== 'all' ? <StatusPill label={request.level} tone="green" /> : null}
              <StatusPill
                label={HELP_TYPES.find((item) => item.id === request.helpType)?.title
                  ?? (request.serviceType === 'exam_prep' ? 'Exam prep' : request.serviceType === 'assignment_project' ? 'Homework help' : 'Online tutoring')}
                tone="green"
              />
                {request.isDirect ? (
                  <View style={[styles.directVipTag, { backgroundColor: colors.leaf }]}>
                    <Ionicons name="sparkles" size={11} color={colors.primary} />
                    <Text style={[styles.directVipTagText, { color: colors.primary }]}>Direct for You</Text>
                  </View>
                ) : null}
              </View>
              {request.example ? <StatusPill label="Example" tone="neutral" /> : null}
            </View>
            <Text style={[styles.requestTitle, { color: colors.foreground }]}>{request.title}</Text>
            {request.university || request.customCourse || request.instructionLanguage ? <Text style={[styles.requestDetails, { color: colors.primary }]}>{[request.university, request.customCourse, request.instructionLanguage ? `Tutoring in ${request.instructionLanguage}` : null].filter(Boolean).join(' · ')}</Text> : null}
            <Text style={[styles.requestDetails, { color: colors.mutedForeground }]}>
              {request.details}
            </Text>
            <View style={styles.requestMeta}>
              <Text style={[styles.requestMetaText, { color: colors.mutedForeground }]}>
                Preferred by: {request.deadline}
              </Text>
              <Text style={[styles.requestBudget, { color: colors.primary }]}>
                Budget up to ${request.budget}
              </Text>
            </View>
            {accountTutor ? <Text style={[styles.requestMetaText, { color: colors.mutedForeground }]}>{request.sessionDurationMinutes ?? 60} min · {request.preferredTimes?.length ? request.preferredTimes.join(' · ') : 'Flexible timing'} · {request.timezone ?? 'Local time'}</Text> : null}
            {accountTutor && request.attachments?.length ? (
              <View style={[styles.requestFiles, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.requestFilesLabel, { color: colors.mutedForeground }]}>STUDY MATERIALS</Text>
                {request.attachments.map((attachment) => <HapticPressable key={attachment.id} accessibilityRole="button" onPress={() => void openRequestFile(request.id, attachment)} style={styles.requestFileButton}><Ionicons name={attachment.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={15} color={colors.primary} /><Text numberOfLines={1} style={[styles.requestFileName, { color: colors.foreground }]}>{attachment.fileName}</Text><Ionicons name="download-outline" size={14} color={colors.mutedForeground} /></HapticPressable>)}
              </View>
            ) : null}
            {offerSent ? (
              <View style={[styles.offerSent, { backgroundColor: colors.leaf }]}>
                <Ionicons name="checkmark-circle-outline" size={17} color={colors.primary} />
                <Text style={[styles.offerSentText, { color: colors.primary }]}>Your offer is saved</Text>
              </View>
            ) : (
              <ActionButton
                label="Send an offer"
                icon="arrow-forward"
                variant="secondary"
                onPress={() => {
                  setActiveOfferRequest(request.id);
                  loadGuidance(request.id);
                  offerSheetRef.current?.present();
                }}
                testID={`make-offer-${request.id}`}
              />
            )}
            {accountTutor && offerSent && request.ownOfferId ? <>
              <HapticPressable onPress={() => void toggleLearnerChat(request)} style={[styles.chatToggle, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                <Text style={[styles.chatToggleText, { color: colors.primary }]}>{openChatRequest === request.id ? 'Close conversation' : 'Message learner'}</Text>
              </HapticPressable>
              {openChatRequest === request.id ? <View style={[styles.chatPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {(boardMessages[request.id] ?? []).map((entry) => <View key={entry.id} style={[styles.chatBubble, { backgroundColor: entry.senderId === userId ? colors.leaf : colors.card, alignSelf: entry.senderId === userId ? 'flex-end' : 'flex-start' }]}><Text style={[styles.chatMessage, { color: colors.foreground }]}>{entry.text}</Text></View>)}
                {!boardMessages[request.id]?.length ? <Text style={[styles.chatEmpty, { color: colors.mutedForeground }]}>Use this conversation to answer questions and agree on the session details.</Text> : null}
                <View style={[styles.chatComposer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput value={boardDraft} onChangeText={setBoardDraft} placeholder="Write a message…" placeholderTextColor={colors.mutedForeground} multiline maxLength={2000} style={[styles.chatInput, { color: colors.foreground }]} />
                  <HapticPressable disabled={!boardDraft.trim() || sendingBoardMessage} onPress={() => void sendLearnerMessage(request)} style={[styles.sendMessageButton, { backgroundColor: colors.primary, opacity: !boardDraft.trim() || sendingBoardMessage ? 0.5 : 1 }]}><Ionicons name="arrow-up" size={18} color={colors.primaryForeground} /></HapticPressable>
                </View>
              </View> : null}
            </> : null}
          </View>
        );
      })}
    </Screen>
    <BottomSheetModal
      ref={offerSheetRef}
      snapPoints={['90%']}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {activeRequest ? (
          <ScrollView contentContainerStyle={{ gap: 12, padding: 20 }}>
            <TutorBundleCreator
              offerType={offerType}
              onOfferTypeChange={setOfferType}
              priceText={offerPrice}
              onPriceChange={setOfferPrice}
              sessionCount={sessionCount}
              onSessionCountChange={setSessionCount}
              packageDescription={packageDescription}
              onPackageDescriptionChange={setPackageDescription}
            />

            <Text style={[styles.composerLabel, { color: colors.foreground }]}>
              {offerType === 'package' ? 'Total package price' : 'Your offer price'}
            </Text>
            <View style={[styles.priceEntry, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.dollar, { color: colors.mutedForeground }]}>$</Text>
              <TextInput
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="decimal-pad"
                style={[styles.priceInput, { color: colors.foreground }]}
                accessibilityLabel="Offer price"
                testID={`offer-price-${activeRequest.id}`}
              />
              <Text style={[styles.priceSuffix, { color: colors.mutedForeground }]}>total</Text>
            </View>

            {accountTutor ? (
              <View style={[styles.guidanceCard, { backgroundColor: colors.leaf }]}>
                <View style={styles.guidanceHeading}>
                  <Ionicons name="compass-outline" size={15} color={colors.primary} />
                  <Text style={[styles.guidanceTitle, { color: colors.primary }]}>A little pricing context</Text>
                </View>
                {guidance[activeRequest.id]?.loading ? (
                  <Text style={[styles.guidanceCopy, { color: colors.mutedForeground }]}>Checking similar Juniper sessions…</Text>
                ) : guidance[activeRequest.id]?.error ? (
                  <Text style={[styles.guidanceCopy, { color: colors.mutedForeground }]}>Pricing context is unavailable right now. The learner’s budget is ${activeRequest.budget.toFixed(0)}.</Text>
                ) : guidance[activeRequest.id]?.sampleCount && (guidance[activeRequest.id]?.sampleCount ?? 0) >= 3 ? (
                  <Text style={[styles.guidanceCopy, { color: colors.foreground }]}>
                    {guidance[activeRequest.id]!.sampleCount} similar sessions were agreed at ${(guidance[activeRequest.id]!.lowCents! / 100).toFixed(0)}–${(guidance[activeRequest.id]!.highCents! / 100).toFixed(0)}; the middle offer was ${(guidance[activeRequest.id]!.medianCents! / 100).toFixed(0)}. Learner budget: ${activeRequest.budget.toFixed(0)}. This is historical context, not a required rate.
                  </Text>
                ) : (
                  <Text style={[styles.guidanceCopy, { color: colors.foreground }]}>
                    There isn’t enough history for a reliable range yet. Learner budget: ${activeRequest.budget.toFixed(0)}. Choose a rate that feels fair for your time.
                  </Text>
                )}
              </View>
            ) : null}

            <Text style={[styles.composerLabel, { color: colors.foreground, marginTop: 4 }]}>Suggest an exact session time below, or arrange it in chat after the learner accepts.</Text>

            <HapticPressable
              onPress={() => setIncludesWalkthrough(!includesWalkthrough)}
              style={[
                styles.walkthroughToggleCard,
                {
                  backgroundColor: includesWalkthrough ? colors.leaf : colors.background,
                  borderColor: includesWalkthrough ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={includesWalkthrough ? 'checkbox' : 'square-outline'}
                size={18}
                color={includesWalkthrough ? colors.primary : colors.mutedForeground}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.walkthroughTitle, { color: includesWalkthrough ? colors.deep : colors.foreground }]}>
                  Include a clear learning explanation
                </Text>
                <Text style={[styles.walkthroughSubtitle, { color: colors.mutedForeground }]}>
                  Let the learner know you’ll explain the ideas and work through examples together.
                </Text>
              </View>
            </HapticPressable>

            <TextInput
              value={offerNote}
              onChangeText={setOfferNote}
              multiline
              maxLength={180}
              placeholder="Introduce yourself and explain how you can help (for example, ‘We can work through a few practice problems together.’)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.noteInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              accessibilityLabel="Offer note"
            />

            {accountTutor && activeRequest.serviceType === 'live_session' ? (
              <>
                <Text style={[styles.composerLabel, { color: colors.foreground }]}>Suggest a session time (optional)</Text>
                <View style={styles.scheduleInputs}>
                  <TextInput value={offerDate} onChangeText={setOfferDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} accessibilityLabel="Suggested session date" style={[styles.scheduleInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
                  <TextInput value={offerTime} onChangeText={setOfferTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} accessibilityLabel="Suggested session time" style={[styles.scheduleInput, styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
                </View>
                <Text style={[styles.requestMetaText, { color: colors.mutedForeground }]}>Your device time zone. You can agree on a different time in chat.</Text>
              </>
            ) : null}

            {message ? <Text style={[styles.inlineMessage, { color: colors.primary }]}>{message}</Text> : null}

            <View style={styles.offerActions}>
              <ActionButton
                label={offerType === 'package' ? 'Send bundle offer' : 'Send offer'}
                icon="arrow-forward"
                onPress={() => {
                  void submitOffer(activeRequest.id, {
                    includesWalkthrough,
                    offerType,
                    packageSessionCount: offerType === 'package' ? sessionCount : undefined,
                    packageDescription: offerType === 'package' ? packageDescription : undefined,
                  });
                  offerSheetRef.current?.dismiss();
                }}
                testID={`send-offer-${activeRequest.id}`}
              />
              <ActionButton
                label="Cancel"
                variant="quiet"
                onPress={() => {
                  setActiveOfferRequest(null);
                  offerSheetRef.current?.dismiss();
                }}
              />
            </View>
          </ScrollView>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  </>
  );
}

const styles = StyleSheet.create({
  chatToggle: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12 },
  chatToggleText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chatPanel: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 10 },
  chatBubble: { borderRadius: 12, maxWidth: '88%', paddingHorizontal: 11, paddingVertical: 8 },
  chatMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  chatEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, padding: 4 },
  chatComposer: { alignItems: 'flex-end', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 8 },
  chatInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, maxHeight: 100, minHeight: 36, paddingHorizontal: 4, paddingTop: 8 },
  sendMessageButton: { alignItems: 'center', borderRadius: 99, height: 34, justifyContent: 'center', width: 34 },
  searchBox: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderTopColor: '#2A5240',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, minHeight: 46 },
  filterRow: { gap: 8, paddingVertical: 14 },
  pathLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1, marginTop: 16, marginBottom: 8 },
  pathHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 6 },
  filterButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 12, minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  filterButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  filterBadge: { borderRadius: 6, height: 8, width: 8 },
  filterCaption: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 4 },
  bottomPrompt: { borderRadius: 24, borderWidth: 1, gap: 12, marginTop: 18, padding: 20 },
  promptTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  promptCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  tutorIdentity: { borderRadius: 20, marginTop: 18, padding: 16 },
  tutorIdentityLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  tutorIdentityName: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.4, marginTop: 6 },
  tutorIdentitySubject: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  requestCard: { borderRadius: 22, borderWidth: 1, borderTopColor: '#2A5240', gap: 11, marginBottom: 14, padding: 16 },
  workloadCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 12, padding: 12 },
  workloadIcon: { alignItems: 'center', borderRadius: 11, height: 34, justifyContent: 'center', width: 34 },
  workloadTitle: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  workloadCopy: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
  requestTopRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  requestTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3, lineHeight: 22, marginTop: 3 },
  requestDetails: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  requestMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  requestMetaText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  requestBudget: { fontFamily: 'Inter_700Bold', fontSize: 12, fontVariant: ['tabular-nums'] },
  requestFiles: { borderRadius: 14, borderWidth: 1, gap: 5, padding: 9 },
  requestFilesLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.8 },
  requestFileButton: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 30, paddingHorizontal: 2 },
  requestFileName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 10 },
  offerSent: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 13 },
  offerSentText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  offerComposer: { borderTopWidth: 1, gap: 10, marginTop: 6, paddingTop: 14 },
  guidanceCard: { borderRadius: 14, gap: 6, padding: 11 },
  guidanceHeading: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  guidanceTitle: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  guidanceCopy: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  composerLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: -0.1 },
  priceEntry: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 13 },
  dollar: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  priceInput: { fontFamily: 'Inter_700Bold', fontSize: 17, minHeight: 46, paddingHorizontal: 8, width: 74 },
  priceSuffix: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  noteInput: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 72, padding: 13, textAlignVertical: 'top' },
  inlineMessage: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  realTutorCard: { borderRadius: 22, borderWidth: 1, borderTopColor: '#2A5240', gap: 13, marginBottom: 14, padding: 16 },
  realTutorTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  realTutorAvatar: { alignItems: 'center', borderRadius: 16, height: 46, justifyContent: 'center', width: 46 },
  realTutorIdentity: { flex: 1, gap: 3 },
  realTutorName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  realTutorMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  fitPanel: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)', gap: 8, padding: 13 },
  fitHeading: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.2, marginBottom: 1 },
  fitLine: { alignItems: 'flex-start', flexDirection: 'row', gap: 7 },
  fitText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 15 },
  realTutorBio: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  realTutorFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  realTutorRate: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  viewProfileButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46, marginTop: 8 },
  viewProfileText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  approvedBadge: { alignItems: 'center', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  approvedText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  offerActions: { gap: 8 },
  scheduleInputs: { flexDirection: 'row', gap: 8 },
  scheduleInput: { borderRadius: 14, borderWidth: 1, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 46, paddingHorizontal: 12 },
  timeInput: { flex: 0.65 },
  roleSwitchBoardBtn: { alignItems: 'center', borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  roleSwitchBoardText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.1 },
  directVipTag: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  directVipTagText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.1 },
  serviceBadge: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  serviceBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.1 },
  turnaroundChip: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  turnaroundChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  walkthroughToggleCard: { borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12, alignItems: 'center', marginVertical: 4 },
  walkthroughTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: -0.1 },
  walkthroughSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, marginTop: 2 },
  tutorCoursesRow: { gap: 6, paddingTop: 4 },
  tutorCoursesLabelWrap: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  tutorCoursesLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 },
  tutorCoursePill: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 3 },
  tutorCourseUni: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  tutorCourseCode: { fontFamily: 'Inter_700Bold', fontSize: 11 },
});
