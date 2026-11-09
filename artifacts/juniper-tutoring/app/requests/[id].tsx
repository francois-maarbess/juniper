import React, { useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';
import { useJuniper } from '@/context/JuniperContext';
import {
  ActionButton,
  EmptyState,
  PageHeader,
  Screen,
  SectionHeading,
  StatusPill,
} from '@/components/JuniperUI';
import { BundleOfferCard } from '@/components/BundleOfferCard';
import { useColors } from '@/hooks/useColors';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { HELP_TYPES } from '@/components/HelpTypeGrid';

export default function RequestDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useJuniper();
  const { request: apiRequest, download } = useAuth();
  const devRequest = __DEV__ ? state.requests.find((item) => item.id === id) : undefined;
  const devOffers = __DEV__ ? state.offers.filter((offer) => offer.requestId === id) : [];

  const [remoteRequest, setRemoteRequest] = useState<{
    id: string;
    title: string;
    details: string;
    deadline: string;
    budgetCents: number;
    status: string;
    subject: string;
    helpType?: string;
    customSubject?: string | null;
    customCourse?: string | null;
    university?: string | null;
    instructionLanguage?: string | null;
    learner?: string;
    targetTutorId?: string | null;
    targetTutorName?: string | null;
    sessionDurationMinutes?: number;
    preferredTimes?: string[];
    attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>;
  } | null>(null);

  const [remoteOffers, setRemoteOffers] = useState<Array<{
    id: string;
    amountCents: number;
    note: string;
    tutorId: string;
    tutorName: string;
    headline: string | null;
    turnaroundHours?: number | null;
    includesWalkthrough?: boolean;
    offerType?: string;
    packageSessionCount?: number | null;
    packageDescription?: string | null;
  }>>([]);

  const [remoteError, setRemoteError] = useState('');
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [activeOfferChat, setActiveOfferChat] = useState<string | null>(null);
  const [offerMessages, setOfferMessages] = useState<Record<string, Array<{ id: string; senderId: string; text: string; createdAt: string; senderName?: string }>>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const openRequestAttachment = async (attachment: { id: string; fileName: string }) => {
    if (!id) return;
    try {
      const { blob } = await download(`/marketplace/requests/${id}/attachments/${attachment.id}`);
      const safeName = attachment.fileName.replace(/[\\/\0-\x1f]/g, '_').slice(0, 120) || 'learning-file';
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const file = new File(Paths.cache, `${attachment.id}-${safeName}`);
        await file.write(new Uint8Array(await blob.arrayBuffer()));
        await Sharing.shareAsync(file.uri, { dialogTitle: 'Open study material' });
      }
      setFileError('');
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'This file could not be opened.');
    }
  };

  useEffect(() => {
    if (!id || devRequest) return;
    let active = true;
    void Promise.all([
      apiRequest<typeof remoteRequest>(`/marketplace/requests/${id}`),
      apiRequest<typeof remoteOffers>(`/marketplace/requests/${id}/offers`),
    ])
      .then(([loadedRequest, loadedOffers]) => {
        if (active) {
          setRemoteRequest(loadedRequest);
          setRemoteOffers(loadedOffers);
        }
      })
      .catch((caught: unknown) => {
        if (active) setRemoteError(caught instanceof Error ? caught.message : 'Could not load this task.');
      });
    return () => {
      active = false;
    };
  }, [id, devRequest, apiRequest]);

  const acceptRealOffer = async (offerId: string) => {
    setAcceptingOffer(offerId);
    setRemoteError('');
    try {
      const res = await apiRequest<{ booking?: { id: string }; id?: string }>(
        `/marketplace/offers/${offerId}/accept`,
        { method: 'POST', body: {} }
      );
      hapticSuccess();
      const bookingId = res?.booking?.id || res?.id;
      if (bookingId) {
        router.replace(`/workroom/${bookingId}`);
      } else {
        router.replace('/(tabs)/activity');
      }
    } catch (caught) {
      setRemoteError(caught instanceof Error ? caught.message : 'This offer could not be accepted.');
      setAcceptingOffer(null);
    }
  };

  const openOfferChat = async (offerId: string) => {
    setActiveOfferChat(offerId);
    setRemoteError('');
    try {
      const items = await apiRequest<Array<{ id: string; senderId: string; text: string; createdAt: string; senderName?: string }>>(
        `/marketplace/requests/${id}/offers/${offerId}/messages`,
      );
      setOfferMessages((current) => ({ ...current, [offerId]: items }));
    } catch (caught) {
      setRemoteError(caught instanceof Error ? caught.message : 'Could not open this conversation.');
    }
  };

  const sendOfferChatMessage = async (offerId: string) => {
    const text = messageDraft.trim();
    if (!text || sendingMessage) return;
    setSendingMessage(true);
    try {
      const saved = await apiRequest<{ id: string; senderId: string; text: string; createdAt: string }>(
        `/marketplace/requests/${id}/offers/${offerId}/messages`,
        { method: 'POST', body: { text } },
      );
      setOfferMessages((current) => ({ ...current, [offerId]: [...(current[offerId] ?? []), saved] }));
      setMessageDraft('');
    } catch (caught) {
      setRemoteError(caught instanceof Error ? caught.message : 'Message could not be sent.');
    } finally {
      setSendingMessage(false);
    }
  };

  const currentReq = remoteRequest || (devRequest ? {
    id: devRequest.id,
    title: devRequest.title,
    details: devRequest.details,
    deadline: devRequest.deadline,
    budgetCents: devRequest.budget * 100,
    status: devRequest.status,
    subject: devRequest.subject,
    helpType: undefined,
    customSubject: null,
    attachments: [],
    targetTutorName: null,
  } : null);

  const currentOffers = remoteRequest ? remoteOffers : devOffers.map((o) => {
    const t = SAMPLE_TUTORS.find((item) => item.id === o.tutorId);
    return {
      id: o.id,
      amountCents: o.price * 100,
      note: o.note,
      tutorId: o.tutorId,
      tutorName: t?.name ?? 'Tutor',
      headline: t?.focus ?? 'Top Rated Subject Expert',
      turnaroundHours: null,
      includesWalkthrough: true,
      offerType: 'hourly' as string | undefined,
      packageSessionCount: null as number | null | undefined,
      packageDescription: null as string | null | undefined,
    };
  });

  if (!currentReq && !remoteError) {
    return (
      <Screen>
        <PageHeader title="Your request" eyebrow="Loading details" onBack={() => router.back()} />
        <View style={styles.loadingBox}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your request…</Text>
        </View>
      </Screen>
    );
  }

  if (!currentReq) {
    return (
      <Screen>
        <PageHeader title="Request not found" eyebrow="Tutoring request" onBack={() => router.back()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Request not found"
          description={remoteError || 'This tutoring request may have been removed.'}
          action="Create a request"
          onAction={() => router.replace('/request')}
        />
      </Screen>
    );
  }

  const isMatched = currentReq.status === 'matched';
  const requestedTime = currentReq.preferredTimes?.find((item) => item.startsWith('Requested time: '));
  const availabilityPreferences = currentReq.preferredTimes?.filter((item) => !item.startsWith('Requested time: ')) ?? [];
  const progressSteps = [
    { title: 'Request sent', done: true },
    { title: 'Tutor selected', done: ['matched', 'in_progress', 'completed'].includes(currentReq.status) },
    { title: 'Session arranged', done: ['in_progress', 'completed'].includes(currentReq.status) },
    { title: 'Learning complete', done: currentReq.status === 'completed' },
  ];

  return (
    <Screen>
      <PageHeader
        title="Your learning request"
        eyebrow={`${currentReq.customSubject || currentReq.subject} · ${HELP_TYPES.find((item) => item.id === currentReq.helpType)?.title ?? 'Tutoring request'}`}
        onBack={() => router.back()}
      />

      {/* Request summary */}
      <View style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.taskCardHeader}>
          <StatusPill label={currentReq.customSubject || currentReq.subject} tone="green" />
          <StatusPill label={isMatched ? 'Tutor chosen' : currentReq.status === 'open' ? 'Open for offers' : currentReq.status} tone={isMatched ? 'neutral' : currentReq.status === 'open' ? 'green' : 'neutral'} />
          <View style={[styles.budgetBadge, { backgroundColor: colors.leaf }]}>
            <Text style={[styles.budgetText, { color: colors.primary }]}>
              Budget: ${(currentReq.budgetCents / 100).toFixed(0)}
            </Text>
          </View>
        </View>
        <Text style={[styles.taskTitle, { color: colors.foreground }]}>{currentReq.title}</Text>
        {currentReq.university || currentReq.customCourse || currentReq.instructionLanguage ? <Text style={[styles.taskDetails, { color: colors.primary }]}>{[currentReq.university, currentReq.customCourse, currentReq.instructionLanguage ? `Tutoring in ${currentReq.instructionLanguage}` : null].filter(Boolean).join(' · ')}</Text> : null}
        <Text style={[styles.taskDetails, { color: colors.mutedForeground }]}>{currentReq.details}</Text>
        <View style={styles.turnaroundRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <Text style={[styles.turnaroundText, { color: colors.mutedForeground }]}>Help needed by {new Date(currentReq.deadline).toLocaleDateString()}{requestedTime ? ` · ${requestedTime.slice('Requested time: '.length)}` : availabilityPreferences.length ? ` · Usually free ${availabilityPreferences.join(', ')}` : ' · Flexible availability'}</Text>
        </View>

        {currentReq.attachments && currentReq.attachments.length > 0 && (
          <View style={[styles.materialsPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.materialsTitle, { color: colors.foreground }]}>Study materials ({currentReq.attachments.length})</Text>
            {currentReq.attachments.map((file) => (
              <HapticPressable
                key={file.id}
                onPress={() => void openRequestAttachment(file)}
                style={[styles.fileRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name="document-text" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.fileName, { color: colors.foreground }]}>
                  {file.fileName}
                </Text>
                <Ionicons name="download-outline" size={16} color={colors.mutedForeground} />
              </HapticPressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.progressTitle, { color: colors.foreground }]}>What happens next</Text>
        <Text style={[styles.progressCopy, { color: colors.mutedForeground }]}>
          {currentReq.status === 'open' ? 'Tutors can review your request and send an offer here.' : currentReq.status === 'completed' ? 'This request is complete. Your session recap stays in your learning space.' : 'Message your tutor to agree on the session details.'}
        </Text>
        <View style={styles.progressList}>
          {progressSteps.map((step, index) => <View key={step.title} style={styles.progressStep}>
            <View style={[styles.progressDot, { backgroundColor: step.done ? colors.primary : colors.background, borderColor: step.done ? colors.primary : colors.border }]}>{step.done ? <Ionicons name="checkmark" size={11} color={colors.primaryForeground} /> : null}</View>
            {index < progressSteps.length - 1 ? <View style={[styles.progressLine, { backgroundColor: progressSteps[index + 1].done ? colors.primary : colors.border }]} /> : null}
            <Text style={[styles.progressStepText, { color: step.done ? colors.foreground : colors.mutedForeground }]}>{step.title}</Text>
          </View>)}
        </View>
      </View>

      {fileError ? <Text style={[styles.errorMsg, { color: colors.error }]}>{fileError}</Text> : null}
      {remoteError ? <Text style={[styles.errorMsg, { color: colors.error }]}>{remoteError}</Text> : null}

      <SectionHeading title={`Tutor offers (${currentOffers.length})`} />

      {currentOffers.length ? (
        currentOffers.map((offer) => {
          if (offer.offerType === 'package' || (offer.packageSessionCount && offer.packageSessionCount > 1)) {
            return (
              <BundleOfferCard
                key={offer.id}
                offer={offer}
                isAccepting={acceptingOffer === offer.id}
                disabled={isMatched || acceptingOffer !== null}
                onAccept={(offerId) => void acceptRealOffer(offerId)}
              />
            );
          }

          return (
            <View key={offer.id} style={[styles.offerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Tutor Header */}
              <View style={styles.offerHeader}>
                <View style={[styles.tutorAvatarBox, { backgroundColor: colors.leaf }]}>
                  <Ionicons name="school" size={22} color={colors.primary} />
                </View>
                <View style={styles.tutorMeta}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.tutorName, { color: colors.foreground }]}>{offer.tutorName}</Text>
                  </View>
                  <Text style={[styles.tutorHeadline, { color: colors.mutedForeground }]}>
                    {offer.headline ?? 'Juniper tutor'}
                  </Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={[styles.priceAmount, { color: colors.primary }]}>
                    ${(offer.amountCents / 100).toFixed(0)}
                  </Text>
                  <Text style={[styles.priceTag, { color: colors.mutedForeground }]}>Offer price</Text>
                </View>
              </View>

              {/* Pitch & Turnaround Details */}
              <View style={[styles.pitchBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.pitchText, { color: colors.foreground }]}>{offer.note}</Text>
                <View style={styles.turnaroundRow}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={[styles.turnaroundText, { color: colors.primary }]}>
                    Session time: to agree in chat
                  </Text>
                </View>
              </View>

              <HapticPressable
                onPress={() => activeOfferChat === offer.id ? setActiveOfferChat(null) : void openOfferChat(offer.id)}
                style={[styles.chatToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                <Text style={[styles.chatToggleText, { color: colors.primary }]}>{activeOfferChat === offer.id ? 'Close conversation' : 'Ask this tutor a question'}</Text>
                <Ionicons name={activeOfferChat === offer.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </HapticPressable>

              {activeOfferChat === offer.id ? <View style={[styles.chatPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {(offerMessages[offer.id] ?? []).length ? (offerMessages[offer.id] ?? []).map((message) => (
                  <View key={message.id} style={[styles.chatBubble, { backgroundColor: message.senderId === offer.tutorId ? colors.card : colors.leaf, alignSelf: message.senderId === offer.tutorId ? 'flex-start' : 'flex-end' }]}>
                    <Text style={[styles.chatSender, { color: colors.mutedForeground }]}>{message.senderName || (message.senderId === offer.tutorId ? offer.tutorName : 'You')}</Text>
                    <Text style={[styles.chatMessage, { color: colors.foreground }]}>{message.text}</Text>
                  </View>
                )) : <Text style={[styles.chatEmpty, { color: colors.mutedForeground }]}>Ask about the plan, availability, or what the offer includes.</Text>}
                <View style={[styles.chatComposer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput value={messageDraft} onChangeText={setMessageDraft} placeholder="Write a message…" placeholderTextColor={colors.mutedForeground} multiline maxLength={2000} style={[styles.chatInput, { color: colors.foreground }]} />
                  <HapticPressable disabled={!messageDraft.trim() || sendingMessage} onPress={() => void sendOfferChatMessage(offer.id)} style={[styles.sendMessageButton, { backgroundColor: colors.primary, opacity: !messageDraft.trim() || sendingMessage ? 0.5 : 1 }]}>
                    <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
                  </HapticPressable>
                </View>
              </View> : null}

              {/* Action Button */}
              <ActionButton
                label={acceptingOffer === offer.id ? "Opening session…" : "Choose this tutor"}
                icon="arrow-forward"
                disabled={isMatched || acceptingOffer !== null}
                onPress={() => void acceptRealOffer(offer.id)}
              />
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="radio-outline"
          title="No offers yet"
          description="Tutors who match your subject can review this request. Check back here for offers."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: { borderRadius: 18, borderWidth: 1, gap: 6, marginTop: 14, padding: 16 },
  progressTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  progressCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  progressList: { gap: 0, marginTop: 4 },
  progressStep: { alignItems: 'center', flexDirection: 'row', minHeight: 30 },
  progressDot: { alignItems: 'center', borderRadius: 99, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  progressLine: { height: 10, left: 9, position: 'absolute', top: 25, width: 2 },
  progressStepText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginLeft: 10 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  timerContainer: { borderRadius: 18, borderWidth: 1, padding: 14, marginVertical: 8, alignItems: 'center' },
  timerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  timerHeading: { color: '#F87171', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockDigitBox: { alignItems: 'center', minWidth: 54 },
  clockDigit: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5 },
  clockLabel: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold', fontSize: 9, marginTop: 2 },
  clockSeparator: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', paddingBottom: 10 },
  statusTicker: { borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, marginBottom: 14 },
  statusTickerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pulseCircle: { width: 8, height: 8, borderRadius: 4 },
  statusTickerText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  tickerDivider: { width: 1, height: 20 },
  taskCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10, marginBottom: 14, shadowColor: '#183B31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  budgetText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  taskTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  taskDetails: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  materialsPanel: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6, marginTop: 4 },
  materialsTitle: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  fileRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 8 },
  fileName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11 },
  guaranteeBanner: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, padding: 12, marginBottom: 14 },
  guaranteeTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  guaranteeSub: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  offerCard: { borderRadius: 20, borderWidth: 1.5, gap: 12, marginBottom: 14, padding: 16, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tutorAvatarBox: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  tutorMeta: { flex: 1 },
  tutorName: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  chatToggle: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12 },
  chatToggleText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chatPanel: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 10 },
  chatBubble: { borderRadius: 12, maxWidth: '88%', paddingHorizontal: 11, paddingVertical: 8 },
  chatSender: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginBottom: 3 },
  chatMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  chatEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, padding: 4 },
  chatComposer: { alignItems: 'flex-end', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 8 },
  chatInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, maxHeight: 100, minHeight: 36, paddingHorizontal: 4, paddingTop: 8 },
  sendMessageButton: { alignItems: 'center', borderRadius: 99, height: 34, justifyContent: 'center', width: 34 },
  tutorHeadline: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  statsBadgeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ratingStat: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  speedStat: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  priceContainer: { alignItems: 'flex-end' },
  priceAmount: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  priceTag: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  pitchBox: { borderRadius: 12, padding: 12, gap: 6 },
  pitchText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  turnaroundRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  turnaroundText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  errorMsg: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 },
});
