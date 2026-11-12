import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, PageHeader } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { createJuniperRealtimeSocket, createJuniperWorkroomSocket } from '@/lib/realtime';
import { chatStore, useChatStore, type ChatMessage, type MessageAttachment } from '@/store/chatStore';
import { ResourcesZone } from '@/components/ResourcesZone';
import { ChatSkeleton } from '@/components/LoadingSkeleton';
import { Whiteboard, type WhiteboardElement } from '@/components/Whiteboard';
import { CallMediaStage } from '@/components/CallMediaStage';
import { useWorkroomCall } from '@/hooks/useWorkroomCall';
import { HapticPressable } from '@/components/HapticPressable';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';

type AccountBooking = {
  id: string;
  subject: string;
  title: string;
  tutorName: string;
  learnerName: string;
  tutorId?: string;
  learnerId?: string;
  amountCents: number;
  status: string; // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  paymentStatus?: string; // 'pending' | 'reported' | 'confirmed'
  paymentMethodAgreed?: string | null;
  solutionSummary?: string | null;
  explanationWalkthrough?: string | null;
  revisionNotes?: string | null;
  revisionRequestedAt?: string | null;
  paymentReceiptFileName?: string | null;
};

export default function WorkroomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user, request, upload, download } = useAuth();

  const [draft, setDraft] = useState('');
  const [accountBooking, setAccountBooking] = useState<AccountBooking | null>(null);
  const [chatError, setChatError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);
  const [whiteboardError, setWhiteboardError] = useState('');
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Solution Delivery State (Tutor)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [solSummary, setSolSummary] = useState('');
  const [solWalkthrough, setSolWalkthrough] = useState('');
  const [delivering, setDelivering] = useState(false);

  // Revision State (Student)
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revNotes, setRevNotes] = useState('');
  const [requestingRev, setRequestingRev] = useState(false);


  const {
    messages,
    isOnline,
    enqueueOptimisticMessage,
    confirmMessageSent,
    markMessageFailed,
    flushQueue,
  } = useChatStore(bookingId || '');

  const socketRef = useRef<any>(null);
  const workroomSocketRef = useRef<any>(null);
  const whiteboardElementsRef = useRef<WhiteboardElement[]>([]);
  const whiteboardVersionRef = useRef(0);

  const isStudent = user?.activeRole === 'student';
  const partnerName = isStudent
    ? (accountBooking?.tutorName ?? 'Tutor')
    : (accountBooking?.learnerName ?? 'Learner');

  const targetUserId = isStudent
    ? (accountBooking?.tutorId ?? '')
    : (accountBooking?.learnerId ?? '');

  const call = useWorkroomCall(bookingId || '', targetUserId, request);

  const loadBookingDetails = useCallback(async () => {
    if (!bookingId) return;
    try {
      const bookings = await request<AccountBooking[]>('/marketplace/bookings');
      const selected = bookings.find((b) => b.id === bookingId);
      if (selected) {
        setAccountBooking(selected);
        if (selected.solutionSummary) setSolSummary(selected.solutionSummary);
        if (selected.explanationWalkthrough) setSolWalkthrough(selected.explanationWalkthrough);
      }
    } catch (e) {
      // Handled silently
    }
  }, [bookingId, request]);

  const performSendMessage = useCallback(async (text: string, attachmentIds: string[] = []): Promise<ChatMessage> => {
    if (!bookingId) throw new Error('Booking ID is missing');
    return request<ChatMessage>(`/marketplace/bookings/${bookingId}/messages`, {
      method: 'POST',
      body: { text, attachmentIds },
    });
  }, [bookingId, request]);

  useEffect(() => {
    if (!user || !bookingId) return;
    let active = true;

    loadBookingDetails().catch((e) => {
      if (active) setChatError(e instanceof Error ? e.message : 'Could not load workroom data.');
    });

    request<ChatMessage[]>(`/marketplace/bookings/${bookingId}/messages`)
      .then((msgs) => {
        if (active) chatStore.setServerMessages(bookingId, msgs);
      })
      .catch(() => {});

    request<{ elements: WhiteboardElement[]; version: number }>(`/marketplace/workroom/${bookingId}/whiteboard`)
      .then((wb) => {
        if (active && wb?.elements) {
          whiteboardElementsRef.current = wb.elements;
          whiteboardVersionRef.current = wb.version;
          setWhiteboardElements(wb.elements);
          setWhiteboardError('');
        }
      })
      .catch((error: unknown) => { if (active) setWhiteboardError(error instanceof Error ? error.message : 'The shared board could not be loaded.'); });

    return () => {
      active = false;
    };
  }, [user, bookingId, request, loadBookingDetails]);

  useEffect(() => {
    if (!user || !bookingId) return;
    const socket = createJuniperWorkroomSocket();
    if (!socket) {
      setWhiteboardError('The shared board is offline. Reconnect to collaborate.');
      return;
    }
    workroomSocketRef.current = socket;
    socket.on('connect', () => {
      setWhiteboardError('');
      socket.emit('join:booking', { bookingId });
    });
    socket.on('whiteboard:draw', (event: any) => {
      if (event.bookingId !== bookingId || !event.element) return;
      if (typeof event.version === 'number') whiteboardVersionRef.current = Math.max(whiteboardVersionRef.current, event.version);
      setWhiteboardElements((current) => {
        if (current.some((item) => item.id === event.element.id)) return current;
        const next = [...current, event.element as WhiteboardElement];
        whiteboardElementsRef.current = next;
        return next;
      });
    });
    socket.on('whiteboard:clear', (event: any) => {
      if (event.bookingId !== bookingId) return;
      whiteboardElementsRef.current = [];
      if (typeof event.version === 'number') whiteboardVersionRef.current = event.version;
      setWhiteboardElements([]);
    });
    socket.on('connect_error', () => setWhiteboardError('Live board sync is unavailable. Your saved work will still be here.'));
    return () => {
      if (socket.connected) socket.emit('leave:booking', { bookingId });
      socket.disconnect();
      if (workroomSocketRef.current === socket) workroomSocketRef.current = null;
    };
  }, [user, bookingId]);

  useEffect(() => {
    if (!user || !bookingId) return;
    const socket = createJuniperRealtimeSocket();
    socketRef.current = socket;
    if (socket) {
      socket.on('connect', () => {
        chatStore.setOnlineStatus(true);
        void flushQueue(performSendMessage);
      });
      socket.on('disconnect', () => chatStore.setOnlineStatus(false));
      socket.on('message:new', (event: any) => {
        if (event.bookingId !== bookingId || !event.message) return;
        chatStore.addIncomingMessage(bookingId, event.message);
        if (event.message.senderId !== user.id) {
          void request(`/marketplace/bookings/${bookingId}/messages/read`, { method: 'PATCH' }).catch(() => {});
        }
      });
    }
    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user, bookingId, flushQueue, performSendMessage, request]);

  const handleSendMessage = useCallback(async () => {
    const text = draft.trim();
    if ((!text && !pendingAttachments.length) || !bookingId || !user) return;
    const attachmentIds = pendingAttachments.map((a) => a.id);
    const tempId = enqueueOptimisticMessage(text, user.id, attachmentIds);
    setDraft('');
    setPendingAttachments([]);
    setChatError('');
    Keyboard.dismiss();
    hapticMedium();
    try {
      const created = await performSendMessage(text, attachmentIds);
      confirmMessageSent(tempId, created);
    } catch (err) {
      markMessageFailed(tempId, err instanceof Error ? err.message : 'Network error');
    }
  }, [bookingId, confirmMessageSent, draft, enqueueOptimisticMessage, markMessageFailed, pendingAttachments, performSendMessage, user]);

  const handlePickChatFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);

      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) {
        form.append('file', asset.file, asset.name);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }

      const uploaded = await upload<{ id: string; fileName: string; sizeBytes: number }>(
        `/marketplace/workroom/${bookingId}/attachments`,
        form
      );
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: uploaded.id,
          fileName: uploaded.fileName,
          mimeType: asset.mimeType || 'application/octet-stream',
          sizeBytes: uploaded.sizeBytes,
        },
      ]);
      hapticSuccess();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleWhiteboardDraw = useCallback((element: WhiteboardElement) => {
    const next = [...whiteboardElementsRef.current, element];
    whiteboardElementsRef.current = next;
    setWhiteboardElements(next);
    setWhiteboardError('');
    const persist = async (elements: WhiteboardElement[], version: number, attempt = 0): Promise<void> => {
      const result = await request<{ conflict?: boolean; serverElements?: WhiteboardElement[]; serverVersion?: number; whiteboard?: { elements: WhiteboardElement[]; version: number } }>(`/marketplace/workroom/${bookingId}/whiteboard`, {
        method: 'POST', body: { elements, version },
      });
      if (result.conflict && result.serverElements && typeof result.serverVersion === 'number') {
        if (attempt >= 3) throw new Error('The board changed several times. Try drawing again.');
        const merged = [...result.serverElements, ...elements.filter((item) => !result.serverElements!.some((serverItem) => serverItem.id === item.id))];
        await persist(merged, result.serverVersion, attempt + 1);
        return;
      }
      if (!result.whiteboard) throw new Error('The drawing was not saved. Please try again.');
      whiteboardElementsRef.current = result.whiteboard.elements;
      whiteboardVersionRef.current = result.whiteboard.version;
      setWhiteboardElements(result.whiteboard.elements);
      workroomSocketRef.current?.emit('whiteboard:draw', { bookingId, element, version: result.whiteboard.version });
    };
    void persist(next, whiteboardVersionRef.current).catch((error: unknown) => setWhiteboardError(error instanceof Error ? error.message : 'This drawing could not be saved. Check your connection and try again.'));
  }, [bookingId, request]);

  const handleWhiteboardClear = useCallback(() => {
    setWhiteboardError('');
    void request<{ version: number }>(`/marketplace/workroom/${bookingId}/whiteboard/clear`, { method: 'POST' }).then((result) => {
      whiteboardElementsRef.current = [];
      whiteboardVersionRef.current = result.version;
      setWhiteboardElements([]);
      workroomSocketRef.current?.emit('whiteboard:clear', { bookingId, version: result.version });
    }).catch((error: unknown) => setWhiteboardError(error instanceof Error ? error.message : 'The board could not be cleared. Please try again.'));
  }, [bookingId, request]);

  // Tutor: Deliver Solution
  const handleDeliverSolution = async () => {
    if (!bookingId) return;
    if (solSummary.trim().length < 6) {
      setChatError('Add a short summary of the key ideas covered in your session.');
      return;
    }
    if (solWalkthrough.trim().length < 15) {
      setChatError('Add a few clear explanations or next steps for the learner.');
      return;
    }
    setDelivering(true);
    setChatError('');
    try {
      await request(`/marketplace/bookings/${bookingId}/deliver-solution`, {
        method: 'POST',
        body: {
          solutionSummary: solSummary.trim(),
          explanationWalkthrough: solWalkthrough.trim(),
          deliverables: [],
        },
      });
      hapticSuccess();
      setSuccessMsg('Your learning recap has been shared with the learner.');
      setShowDeliveryForm(false);
      await loadBookingDetails();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Your recap could not be saved.');
    } finally {
      setDelivering(false);
    }
  };

  // Student: Request Revision
  const handleRequestRevision = async () => {
    if (!bookingId) return;
    if (revNotes.trim().length < 6) {
      setChatError('Please describe specifically what needs revision.');
      return;
    }
    setRequestingRev(true);
    setChatError('');
    try {
      await request(`/marketplace/bookings/${bookingId}/request-revision`, {
        method: 'POST',
        body: { revisionNotes: revNotes.trim() },
      });
      hapticSuccess();
      setSuccessMsg('Revision requested. Tutor has been notified.');
      setShowRevisionForm(false);
      await loadBookingDetails();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not submit revision.');
    } finally {
      setRequestingRev(false);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
        <Text style={{ color: colors.foreground }}>Sign in required to access workroom.</Text>
      </View>
    );
  }

  if (!accountBooking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 67 }}>
        <PageHeader title="Session space" onBack={() => router.back()} />
        {chatError ? (
          <Text style={{ color: colors.destructive, padding: 20 }}>{chatError}</Text>
        ) : (
          <ChatSkeleton />
        )}
      </View>
    );
  }

  const isDelivered = Boolean(accountBooking.solutionSummary);
  const isCompleted = accountBooking.status === 'completed';
  const callActive = call.callState === 'connecting' || call.callState === 'ringing' || call.callState === 'connected';

  // Keep the lesson journey focused on learning progress.
  let milestoneStep = accountBooking.status === 'in_progress' ? 1 : 0;
  if (isDelivered) milestoneStep = 2;
  if (isCompleted) milestoneStep = 3;

  const orderedMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.headerWrap, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <View style={styles.chatHeader}>
          <HapticPressable accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          </HapticPressable>
          <View style={[styles.accountAvatar, { backgroundColor: colors.leaf }]}>
            <Ionicons name="school" size={18} color={colors.primary} />
          </View>
          <View style={styles.tutorHeaderCopy}>
            <Text style={[styles.tutorName, { color: colors.foreground }]}>{partnerName}</Text>
            <Text style={[styles.tutorSubject, { color: colors.mutedForeground }]}>
              {accountBooking.subject} · {accountBooking.title}
            </Text>
          </View>

          {/* Whiteboard Toggle */}
          <HapticPressable
            accessibilityRole="button"
            onPress={() => setShowWhiteboard(!showWhiteboard)}
            style={[styles.iconBtn, { backgroundColor: showWhiteboard ? colors.leaf : colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </HapticPressable>

          {/* Video call actions */}
          {call.incomingCall ? (
            <>
              <HapticPressable accessibilityRole="button" accessibilityLabel="Accept video call" onPress={() => void call.acceptCall()} style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Ionicons name="call" size={17} color="#fff" />
              </HapticPressable>
              <HapticPressable accessibilityRole="button" accessibilityLabel="Decline video call" onPress={call.declineCall} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="close" size={18} color={colors.destructive} />
              </HapticPressable>
            </>
          ) : !callActive ? (
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Start video call"
              onPress={() => void call.startCall()}
              style={[styles.iconBtn, { backgroundColor: colors.leaf, borderColor: colors.border }]}
            >
              <Ionicons name="videocam-outline" size={18} color={colors.primary} />
            </HapticPressable>
          ) : (
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="End video call"
              onPress={call.endCall}
              style={[styles.iconBtn, { backgroundColor: colors.destructive, borderColor: colors.destructive }]}
            >
              <Ionicons name="call" size={18} color="#fff" />
            </HapticPressable>
          )}
        </View>
        {call.callError ? <Text accessibilityRole="alert" style={[styles.statusMsg, { color: colors.destructive }]}>{call.callError}</Text> : null}
        {call.localStream || call.remoteStream ? <CallMediaStage localStream={call.localStream} remoteStream={call.remoteStream} callState={call.callState} /> : null}

        {/* 1. MILESTONE PIPELINE HEADER */}
        <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pipelineSteps}>
            {['Scheduled', 'Lesson', 'Learning recap', 'Complete'].map((step, idx) => {
              const active = idx <= milestoneStep;
              const isCurrent = idx === milestoneStep;
              return (
                <View key={step} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: isCurrent ? colors.orange : 'transparent',
                        borderWidth: isCurrent ? 2 : 0,
                      },
                    ]}
                  >
                    {active ? (
                      <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.stepNum, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: active ? colors.foreground : colors.mutedForeground,
                        fontFamily: isCurrent ? 'Inter_700Bold' : 'Inter_500Medium',
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 3. SOLUTION / REVISION STATION */}
        {!isStudent && (
          <View style={[styles.stationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stationHeader}>
              <Ionicons name={isDelivered ? "checkmark-circle" : "document-text"} size={18} color={isDelivered ? colors.liveEmerald : colors.primary} />
              <Text style={[styles.stationTitle, { color: colors.foreground }]}>
                {isDelivered ? 'Learning recap shared' : 'Share a learning recap'}
              </Text>
              <HapticPressable
                onPress={() => setShowDeliveryForm(!showDeliveryForm)}
                style={[styles.toggleBtn, { backgroundColor: colors.leaf }]}
              >
                <Text style={[styles.toggleBtnText, { color: colors.primary }]}>
                  {showDeliveryForm ? 'Close' : isDelivered ? 'Edit recap' : 'Write a recap'}
                </Text>
              </HapticPressable>
            </View>

            {showDeliveryForm && (
              <View style={styles.deliveryForm}>
                <TextInput
                  value={solSummary}
                  onChangeText={setSolSummary}
                  placeholder="What did you cover together? Add the key ideas the learner should remember."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.formInput, { backgroundColor: colors.background, color: colors.foreground }]}
                />
                <TextInput
                  value={solWalkthrough}
                  onChangeText={setSolWalkthrough}
                  multiline
                  placeholder="Add helpful explanations, practice suggestions, or next steps for the learner."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.formTextArea, { backgroundColor: colors.background, color: colors.foreground }]}
                />
                <ActionButton
                  label={delivering ? 'Saving recap…' : 'Share recap with learner'}
                  icon="arrow-forward"
                  onPress={() => void handleDeliverSolution()}
                  disabled={delivering}
                />
              </View>
            )}
          </View>
        )}

        {isStudent && isDelivered && (
          <View style={[styles.stationCard, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
            <View style={styles.stationHeader}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stationTitle, { color: colors.primary }]}>Your tutor shared a learning recap</Text>
                <Text style={[styles.stationSub, { color: colors.foreground }]}>{accountBooking.solutionSummary}</Text>
              </View>
              <HapticPressable
                onPress={() => setShowRevisionForm(!showRevisionForm)}
                style={[styles.toggleBtn, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.toggleBtnText, { color: colors.foreground }]}>Revision</Text>
              </HapticPressable>
            </View>
            {accountBooking.explanationWalkthrough && (
              <Text style={[styles.walkthroughText, { color: colors.foreground }]}>
                {accountBooking.explanationWalkthrough}
              </Text>
            )}
            {showRevisionForm && (
              <View style={styles.deliveryForm}>
                <TextInput
                  value={revNotes}
                  onChangeText={setRevNotes}
                  multiline
                  placeholder="Describe needed adjustments or questions..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.formTextArea, { backgroundColor: colors.card, color: colors.foreground }]}
                />
                <ActionButton
                  label={requestingRev ? 'Requesting…' : 'Submit Revision Request'}
                  variant="secondary"
                  onPress={() => void handleRequestRevision()}
                  disabled={requestingRev}
                />
              </View>
            )}
          </View>
        )}

        {chatError ? <Text style={[styles.statusMsg, { color: colors.destructive }]}>{chatError}</Text> : null}
        {successMsg ? <Text style={[styles.statusMsg, { color: colors.success }]}>{successMsg}</Text> : null}
      </View>

      {/* Whiteboard */}
      {showWhiteboard && (
        <View style={styles.whiteboardWrap}>
          {whiteboardError ? <Text accessibilityRole="alert" style={[styles.statusMsg, { color: colors.destructive }]}>{whiteboardError}</Text> : null}
          <Whiteboard
            elements={whiteboardElements}
            onDraw={handleWhiteboardDraw}
            onClear={handleWhiteboardClear}
            height={220}
          />
        </View>
      )}

      <ResourcesZone bookingId={bookingId} isCollapsible />

      {/* Messages Feed */}
      {messages.length ? (
        <FlatList
          inverted
          data={orderedMessages}
          keyExtractor={(item) => item.tempId || item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.senderId === user?.id ? styles.outgoingBubble : styles.incomingBubble,
                {
                  backgroundColor: item.senderId === user?.id ? colors.accent : colors.card,
                  borderColor: colors.border,
                  borderTopColor: '#2A5240',
                },
              ]}
            >
              <Text
                style={{
                  color: item.senderId === user?.id ? colors.accentForeground : colors.foreground,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {item.text}
              </Text>
              <Text style={[styles.messageTime, { color: item.senderId === user?.id ? 'rgba(9, 21, 14, 0.7)' : colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
          )}
          initialNumToRender={12}
          contentContainerStyle={styles.messageList}
          keyboardDismissMode="interactive"
        />
      ) : (
        <View style={styles.emptyChat}>
          <Text style={[styles.emptyChatTitle, { color: colors.foreground }]}>
                  Start a conversation about the session, what you want to cover, or your next steps.
          </Text>
        </View>
      )}

      {/* Message Composer with Instant File Attachment */}
      <View
        style={[
          styles.composerWrap,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 10),
          },
        ]}
      >
        {pendingAttachments.length ? (
          <ScrollView horizontal style={{ marginBottom: 8 }}>
            {pendingAttachments.map((f) => (
              <HapticPressable
                key={f.id}
                onPress={() => setPendingAttachments((c) => c.filter((x) => x.id !== f.id))}
                style={[styles.pendingFile, { backgroundColor: colors.leaf }]}
              >
                <Ionicons name="document-outline" size={13} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.pendingFileText, { color: colors.primary }]}>
                  {f.fileName}
                </Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </HapticPressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Attach file"
            onPress={() => void handlePickChatFile()}
            disabled={uploading}
            style={styles.attachButton}
          >
            <Ionicons name="attach" size={22} color={colors.primary} />
          </HapticPressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={uploading ? 'Uploading attachment…' : 'Message your tutor…'}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.composerInput, { color: colors.foreground }]}
          />
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => void handleSendMessage()}
            style={[
              styles.sendButton,
              { backgroundColor: draft.trim() || pendingAttachments.length ? colors.accent : colors.muted },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={19}
              color={draft.trim() || pendingAttachments.length ? colors.accentForeground : colors.mutedForeground}
            />
          </HapticPressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  chatHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 8 },
  backButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  accountAvatar: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  tutorHeaderCopy: { flex: 1 },
  tutorName: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  tutorSubject: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  iconBtn: { alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  pipelineCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  pipelineSteps: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { alignItems: 'center', borderRadius: 12, height: 22, justifyContent: 'center', width: 22, marginBottom: 3 },
  stepNum: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  stepLabel: { fontSize: 9, textAlign: 'center' },
  settlementBanner: { borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, marginBottom: 8 },
  settlementLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  settlementTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  settlementSub: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  settlementActions: { flexDirection: 'row', gap: 6 },
  settleBtn: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  settleBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  stationCard: { borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8 },
  stationHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  stationTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13 },
  stationSub: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },
  toggleBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  toggleBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  deliveryForm: { gap: 8, marginTop: 10 },
  formInput: { borderRadius: 10, borderWidth: 1, borderColor: '#2A5240', fontSize: 13, padding: 8 },
  formTextArea: { borderRadius: 10, borderWidth: 1, borderColor: '#2A5240', fontSize: 13, minHeight: 70, padding: 8 },
  walkthroughText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8 },
  statusMsg: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 4 },
  whiteboardWrap: { height: 220, marginBottom: 8, paddingHorizontal: 16 },
  messageList: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  messageBubble: { borderRadius: 16, borderWidth: 1, maxWidth: '80%', padding: 10 },
  outgoingBubble: { alignSelf: 'flex-end' },
  incomingBubble: { alignSelf: 'flex-start' },
  messageTime: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 4 },
  emptyChat: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  emptyChatTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  composerWrap: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8 },
  composer: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  attachButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 32 },
  composerInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, maxHeight: 100, paddingHorizontal: 4, paddingVertical: 8 },
  sendButton: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  pendingFile: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 6, marginRight: 6, paddingHorizontal: 10, paddingVertical: 6 },
  pendingFileText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, maxWidth: 120 },
});
