import React, { useCallback, useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, PageHeader, Screen, SectionHeading, StatusPill } from '@/components/JuniperUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { SessionDetailSkeleton } from '@/components/LoadingSkeleton';

type Session = {
  id: string;
  tutorId?: string;
  status: string;
  amountCents: number;
  title: string;
  subject: string;
  tutorName: string;
  learnerName: string;
  scheduledAt: string | null;
  durationMinutes: number;
  learningRecap: string | null;
  nextSteps: string | null;
  hasReviewed: boolean;
  serviceType?: string;
  solutionSummary?: string | null;
  explanationWalkthrough?: string | null;
  deliverables?: unknown;
  revisionNotes?: string | null;
  revisionRequestedAt?: string | null;
};

export default function SessionDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  useEffect(() => {
    if (bookingId) {
      router.replace(`/workroom/${bookingId}` as never);
    }
  }, [bookingId, router]);

  const { user, request } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [recap, setRecap] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Tutor delivery state
  const [solutionSummary, setSolutionSummary] = useState('');
  const [explanationWalkthrough, setExplanationWalkthrough] = useState('');

  // Student revision state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [endorsing, setEndorsing] = useState(false);

  const load = useCallback(async () => {
    const rows = await request<Session[]>('/marketplace/bookings');
    const found = rows.find((item) => item.id === bookingId);
    if (!found) throw new Error('This session could not be found in your account.');
    setSession(found);
    if (found.solutionSummary) setSolutionSummary(found.solutionSummary);
    if (found.explanationWalkthrough) setExplanationWalkthrough(found.explanationWalkthrough);
  }, [bookingId, request]);

  useEffect(() => {
    void load().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'Session details could not be loaded.')
    );
  }, [load]);

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccessNotice('');
    try {
      await action();
      if (successMessage) setSuccessNotice(successMessage);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That update could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeliverSolution = async () => {
    if (!session) return;
    if (solutionSummary.trim().length < 10) {
      setError('Please add a short summary of the key ideas you covered.');
      return;
    }
    if (explanationWalkthrough.trim().length < 30) {
      setError('Please add a few clear steps so the learner can follow your approach.');
      return;
    }
    await run(
      () =>
        request(`/marketplace/bookings/${session.id}/deliver-solution`, {
          method: 'POST',
          body: {
            solutionSummary: solutionSummary.trim(),
            explanationWalkthrough: explanationWalkthrough.trim(),
          },
        }),
      'Your learning walkthrough is ready in the shared workroom.'
    );
  };

  const handleRequestRevision = async () => {
    if (!session) return;
    if (revisionNotes.trim().length < 10) {
      setError('Please describe what you would like clarified or improved.');
      return;
    }
    await run(
      () =>
        request(`/marketplace/bookings/${session.id}/request-revision`, {
          method: 'POST',
          body: { revisionNotes: revisionNotes.trim() },
        }),
      'Clarification request sent to your tutor.'
    );
    setShowRevisionForm(false);
    setRevisionNotes('');
  };

  if (!user) {
    return (
      <Screen>
        <PageHeader title="Your session" onBack={() => router.back()} />
        <Text style={[styles.body, { color: colors.mutedForeground }]}>Sign in to see this session.</Text>
      </Screen>
    );
  }

  const isTutor = user.activeRole === 'tutor';
  const isAssignment = session?.serviceType !== 'live_session';

  return (
    <Screen>
      <PageHeader
        title={isAssignment ? 'Assignment Workroom' : 'Session details'}
        eyebrow="A little progress, together"
        onBack={() => router.back()}
      />
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {successNotice ? <Text style={[styles.successNotice, { color: colors.primary }]}>{successNotice}</Text> : null}

      {!session ? (
        <SessionDetailSkeleton />
      ) : (
        <>
          {/* Hero Header */}
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.heroEyebrow, { color: colors.primaryForeground }]}>{session.subject}</Text>
                  {isAssignment ? (
                    <View style={[styles.heroBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="document-text-outline" size={10} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>Assignment & Project</Text>
                    </View>
                  ) : (
                    <View style={[styles.heroBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="school-outline" size={10} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>1-on-1 Class</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>{session.title}</Text>
              </View>
              <StatusPill
                label={session.status === 'completed' ? 'Complete' : session.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
                tone={session.status === 'completed' ? 'neutral' : 'green'}
              />
            </View>

            <View style={styles.heroMeta}>
              <Ionicons name="person-outline" size={15} color={colors.primaryForeground} />
              <Text style={[styles.heroText, { color: colors.primaryForeground }]}>
                {isTutor ? `Learner: ${session.learnerName}` : `Tutor: ${session.tutorName}`}
              </Text>
            </View>

            {session.scheduledAt ? (
              <View style={styles.heroMeta}>
                <Ionicons name="time-outline" size={15} color={colors.primaryForeground} />
                <Text style={[styles.heroText, { color: colors.primaryForeground }]}>
                  {new Date(session.scheduledAt).toLocaleString()} · {session.durationMinutes} min
                </Text>
              </View>
            ) : null}

            <Text style={[styles.heroPrice, { color: colors.primaryForeground }]}>
              Offer · ${(session.amountCents / 100).toFixed(2)}
            </Text>
          </View>

          {/* A clear, calm status card for the shared learning space */}
          <View style={[styles.workroomCard, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
            <View style={styles.workroomHeader}>
              <View style={styles.shieldIconWrap}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="book-outline" size={14} color={colors.primary} />
                  <Text style={[styles.workroomTitle, { color: colors.foreground }]}>
                    {isAssignment ? 'Your learning workroom' : 'Your shared session'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <Ionicons name={session.solutionSummary ? 'checkmark-circle' : 'time-outline'} size={11} color={colors.primary} />
                  <Text style={[styles.workroomStatusLabel, { color: colors.primary }]}>
                    {session.solutionSummary ? 'Learning walkthrough ready' : session.status === 'completed' ? 'Session complete' : 'Ready to arrange in chat'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.workroomDesc, { color: colors.mutedForeground }]}>
              {isAssignment ? 'Keep questions, explanations, and shared learning materials together here.' : 'Use your private chat to agree on the session time and what you will cover.'}
            </Text>
          </View>

          <View style={[styles.paymentNotice, { backgroundColor: colors.pale }]}>
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <Text style={[styles.paymentNoticeText, { color: colors.foreground }]}>Payment is arranged directly between you and your {isTutor ? 'learner' : 'tutor'}. Juniper doesn’t collect, hold, or refund money. Please confirm the agreed amount and cancellation expectations in chat.</Text>
          </View>

          {/* Revision Banner if student requested clarifications */}
          {session.revisionNotes ? (
            <View style={[styles.revisionAlertCard, { backgroundColor: colors.warning, borderColor: colors.warningBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle" size={18} color={colors.warningForeground} />
                <Text style={[styles.revisionAlertTitle, { color: colors.warningForeground }]}>Student Clarification Request</Text>
              </View>
              <Text style={[styles.revisionAlertBody, { color: colors.warningForeground }]}>{session.revisionNotes}</Text>
            </View>
          ) : null}

          {/* Direct Session Chat Action */}
          <View style={styles.actionRow}>
            <ActionButton
              label="Open Workroom"
              icon="chatbubble-ellipses-outline"
              variant="secondary"
              onPress={() => router.push(`/workroom/${session.id}` as never)}
            />
          </View>

          {/* Step-by-Step Educational Walkthrough Section */}
          {(session.solutionSummary || session.explanationWalkthrough) ? (
            <View style={{ marginTop: 14 }}>
              <SectionHeading title="Step-by-Step Educational Walkthrough" />
              <View style={[styles.walkthroughBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {session.solutionSummary ? (
                  <View style={styles.walkthroughSection}>
                    <Text style={[styles.walkthroughSectionLabel, { color: colors.primary }]}>Key ideas from your session</Text>
                    <Text style={[styles.walkthroughAnswerText, { color: colors.foreground }]}>
                      {session.solutionSummary}
                    </Text>
                  </View>
                ) : null}

                {session.explanationWalkthrough ? (
                  <View style={[styles.walkthroughSection, { borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 }]}>
                    <Text style={[styles.walkthroughSectionLabel, { color: colors.primary }]}>Explanations and examples</Text>
                    <Text style={[styles.walkthroughBodyText, { color: colors.foreground }]}>
                      {session.explanationWalkthrough}
                    </Text>
                  </View>
                ) : null}

                {/* Learner clarification controls */}
                {!isTutor && session.solutionSummary && session.status !== 'completed' ? (
                  <View style={[styles.approvalActions, { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 }]}>
                    <ActionButton
                      label="Ask for Clarification / Revision"
                      icon="help-circle-outline"
                      variant="quiet"
                      onPress={() => setShowRevisionForm(!showRevisionForm)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Student Revision Form */}
          {showRevisionForm && !isTutor ? (
            <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.composerLabel, { color: colors.foreground }]}>What would you like clarified?</Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Ask about specific steps, equations, or concepts so your tutor can update the walkthrough.
              </Text>
              <TextInput
                value={revisionNotes}
                onChangeText={setRevisionNotes}
                placeholder="e.g. Could you explain how step 3 derived equation (4)?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={2000}
                style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <ActionButton
                  label="Send clarification"
                  loading={busy}
                  onPress={() => void handleRequestRevision()}
                />
                <ActionButton
                  label="Cancel"
                  variant="quiet"
                  onPress={() => setShowRevisionForm(false)}
                />
              </View>
            </View>
          ) : null}

          {/* Tutor Delivery Composer */}
          {isTutor && session.status !== 'cancelled' && session.status !== 'completed' && isAssignment ? (
            <View style={{ marginTop: 16 }}>
              <SectionHeading
                title={session.solutionSummary ? 'Update the learning walkthrough' : 'Share a learning walkthrough'}
              />
              <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.composerLabel, { color: colors.foreground }]}>Key ideas and takeaways</Text>
                <TextInput
                  value={solutionSummary}
                  onChangeText={setSolutionSummary}
                  placeholder="Summarize concepts the learner can explain or practise independently. Don’t provide work for submission."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={1000}
                  style={[styles.input, styles.shortArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />

                <Text style={[styles.composerLabel, { color: colors.foreground, marginTop: 8 }]}>
                  Step-by-Step Educational Walkthrough
                </Text>
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  Explain your approach, use a teaching example, and help the learner understand the reasoning. Keep the learner’s own graded work theirs.
                </Text>
                <TextInput
                  value={explanationWalkthrough}
                  onChangeText={setExplanationWalkthrough}
                  placeholder="Step 1: Understand the governing principles...\nStep 2: Apply the formula...\nStep 3: Verification..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={10000}
                  style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />

                <ActionButton
                  label={busy ? 'Saving…' : 'Share walkthrough'}
                  icon="checkmark-done"
                  loading={busy}
                  onPress={() => void handleDeliverSolution()}
                />
              </View>
            </View>
          ) : null}

          {/* Session Complete / Reviews */}
          {session.status === 'completed' ? (
            <>
              {session.learningRecap ? (
                <>
                  <SectionHeading title="What you worked on" />
                  <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.body, { color: colors.foreground }]}>{session.learningRecap}</Text>
                    {session.nextSteps ? (
                      <>
                        <Text style={[styles.noteLabel, { color: colors.primary }]}>A good next step</Text>
                        <Text style={[styles.body, { color: colors.foreground }]}>{session.nextSteps}</Text>
                      </>
                    ) : null}
                  </View>
                </>
              ) : null}

              {!isTutor && !session.hasReviewed ? (
                <>
                  <SectionHeading title="How did it feel?" />
                  <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Choose a tutor rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <HapticPressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: rating === value }}
                        accessibilityLabel={`${value} stars`}
                        onPress={() => setRating(value)}
                      >
                        <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={25} color={colors.accent} />
                      </HapticPressable>
                    ))}
                  </View>
                  <TextInput
                    value={review}
                    onChangeText={setReview}
                    placeholder="Share a few words for future learners (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    maxLength={2000}
                    style={[styles.input, styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  />
                  <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}>Endorse a specific skill or course (optional)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <TextInput
                      value={tagInput}
                      onChangeText={setTagInput}
                      placeholder="e.g. Python, LAU CSC243"
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.input, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    />
                    <ActionButton
                      label={endorsing ? '…' : '+1'}
                      variant="secondary"
                      loading={endorsing}
                      onPress={() => {
                        if (!session.tutorId || !tagInput.trim()) return;
                        setEndorsing(true);
                        void request(`/marketplace/tutors/${session.tutorId}/tags/endorse`, {
                          method: 'POST',
                          body: { tag: tagInput.trim() },
                        }).finally(() => {
                          setEndorsing(false);
                          setTagInput('');
                        });
                      }}
                    />
                  </View>

                  <ActionButton
                    label={busy ? 'Saving…' : 'Share your review'}
                    icon="heart-outline"
                    loading={busy}
                    onPress={() =>
                      void run(
                        () =>
                          request(`/marketplace/bookings/${session.id}/reviews`, {
                            method: 'POST',
                            body: { rating, comment: review },
                          }),
                        'Review submitted!'
                      )
                    }
                  />
                </>
              ) : !isTutor ? (
                <View style={[styles.reviewSaved, { backgroundColor: colors.leaf }]}>
                  <Ionicons name="checkmark-circle-outline" size={17} color={colors.primary} />
                  <Text style={[styles.body, { color: colors.primary }]}>Thank you for sharing your experience.</Text>
                </View>
              ) : null}
            </>
          ) : isTutor && !isAssignment && session.status !== 'cancelled' ? (
            <>
              <SectionHeading title="Leave a learning recap" />
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                A thoughtful summary helps the learner keep their momentum after the session.
              </Text>
              <TextInput
                value={recap}
                onChangeText={setRecap}
                placeholder="What did you work through together?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={5000}
                style={[styles.input, styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
              <TextInput
                value={nextSteps}
                onChangeText={setNextSteps}
                placeholder="Suggest one clear next step"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={3000}
                style={[styles.input, styles.textarea, styles.shortArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
              <ActionButton
                label={busy ? 'Saving…' : 'Complete session & share recap'}
                icon="checkmark-circle-outline"
                loading={busy}
                disabled={recap.trim().length < 20 || nextSteps.trim().length < 10}
                onPress={() =>
                  void run(
                    () =>
                      request(`/marketplace/bookings/${session.id}/complete`, {
                        method: 'POST',
                        body: { learningRecap: recap, nextSteps },
                      }),
                    'Session completed!'
                  )
                }
              />
            </>
          ) : null}

          {session.status !== 'completed' && session.status !== 'cancelled' ? (
            <View style={{ marginTop: 14 }}>
              <SectionHeading title="Need to make a change?" />
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                If you need to reschedule or discuss requirements, use the workroom chat.
              </Text>
              <ActionButton
                label={busy ? 'Updating…' : 'Cancel this session'}
                icon="close-circle-outline"
                variant="quiet"
                loading={busy}
                onPress={() =>
                  void run(
                    () =>
                      request(`/marketplace/bookings/${session.id}/cancel`, {
                        method: 'POST',
                        body: {},
                      }),
                    'Session cancelled.'
                  )
                }
              />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    gap: 14,
    marginTop: 18,
    padding: 20,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  heroTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 11 },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, opacity: 0.8, textTransform: 'uppercase' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  heroBadgeText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 10 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.7, lineHeight: 30, marginTop: 5 },
  heroMeta: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  heroText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
  heroPrice: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 3 },
  actionRow: { marginTop: 14 },
  workroomCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 14,
    padding: 16,
  },
  workroomHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  shieldIconWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  workroomTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  workroomStatusLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 2 },
  workroomDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  paymentNotice: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 12, padding: 12 },
  paymentNoticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  revisionAlertCard: { borderRadius: 16, borderWidth: 1, gap: 6, marginTop: 12, padding: 14 },
  revisionAlertTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  revisionAlertBody: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  walkthroughBox: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginTop: 6,
    padding: 18,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  walkthroughSection: { gap: 6 },
  walkthroughSectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  walkthroughAnswerText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22 },
  walkthroughBodyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  approvalActions: { gap: 8 },
  composerLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: -0.1, marginBottom: 4 },
  noteCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  noteLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, marginTop: 5, textTransform: 'uppercase' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  input: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, padding: 14 },
  textarea: { minHeight: 110, textAlignVertical: 'top', marginBottom: 10 },
  shortArea: { minHeight: 70, textAlignVertical: 'top', marginBottom: 10 },
  stars: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  reviewSaved: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 10, padding: 14 },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, marginTop: 12 },
  successNotice: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18, marginTop: 12 },
});
