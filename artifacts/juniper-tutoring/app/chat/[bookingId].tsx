import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/JuniperUI';
import Markdown from 'react-native-markdown-display';
import { useColors } from '@/hooks/useColors';
import { hapticLight } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { createJuniperRealtimeSocket } from '@/lib/realtime';
import { chatStore, useChatStore, type ChatMessage, type MessageAttachment } from '@/store/chatStore';
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder';
import { FileUploadSheet } from '@/components/sheets/FileUploadSheet';
import { WorkroomAudioPlayer } from '@/components/WorkroomAudioPlayer';
import { ResourcesZone } from '@/components/ResourcesZone';
import { ChatSkeleton } from '@/components/LoadingSkeleton';

type AccountBooking = { id: string; subject: string; title: string; tutorName: string; learnerName: string };

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user, request, upload, download } = useAuth();

  const [draft, setDraft] = useState('');
  const [accountBooking, setAccountBooking] = useState<AccountBooking | null>(null);
  const [chatError, setChatError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const uploadSheetRef = useRef<any>(null);

  // Offline-first Chat Store (Zustand-pattern + AsyncStorage cache)
  const {
    messages,
    isOnline,
    isConnecting,
    isFlushing,
    enqueueOptimisticMessage,
    confirmMessageSent,
    markMessageFailed,
    flushQueue,
  } = useChatStore(bookingId || '');

  const socketRef = useRef<ReturnType<typeof createJuniperRealtimeSocket> | null>(null);

  // Core API caller to send a message
  const performSendMessage = useCallback(
    async (text: string, attachmentIds: string[] = []): Promise<ChatMessage> => {
      if (!bookingId) throw new Error('Booking ID is missing');
      return request<ChatMessage>(`/marketplace/bookings/${bookingId}/messages`, {
        method: 'POST',
        body: { text, attachmentIds },
      });
    },
    [bookingId, request]
  );

  // Initialize booking details and authoritative server messages
  useEffect(() => {
    if (!user || !bookingId) return;
    let active = true;

    // Load booking summary
    request<AccountBooking[]>('/marketplace/bookings')
      .then((bookings) => {
        if (!active) return;
        const selected = bookings.find((item) => item.id === bookingId);
        if (!selected) throw new Error('This conversation is not available to your account.');
        setAccountBooking(selected);
      })
      .catch((error: unknown) => {
        if (active) setChatError(error instanceof Error ? error.message : 'Conversation could not be opened.');
      });

    // Fetch server messages to sync with local cache
    request<ChatMessage[]>(`/marketplace/bookings/${bookingId}/messages`)
      .then((serverMessages) => {
        if (!active) return;
        chatStore.setServerMessages(bookingId, serverMessages);
      })
      .catch(() => {
        // If fetch fails (offline), cached messages in useChatStore remain displayed seamlessly
      });

    return () => {
      active = false;
    };
  }, [user, bookingId, request]);

  // Socket.IO realtime connection & queue flushing lifecycle
  useEffect(() => {
    if (!user || !bookingId) return;
    let active = true;

    const socket = createJuniperRealtimeSocket();
    socketRef.current = socket;

    if (socket) {
      socket.on('connect', () => {
        if (!active) return;
        chatStore.setOnlineStatus(true);
        // Automatically flush any pending messages upon connection
        void flushQueue(performSendMessage);
      });

      socket.on('disconnect', () => {
        if (active) chatStore.setOnlineStatus(false);
      });

      socket.on('connect_error', () => {
        if (active) chatStore.setOnlineStatus(false);
      });

      socket.on('message:new', (event: { bookingId?: string; message?: ChatMessage }) => {
        if (!active || event.bookingId !== bookingId || !event.message) return;
        chatStore.addIncomingMessage(bookingId, event.message);

        // Acknowledge read if received from partner
        if (event.message.senderId !== user.id) {
          void request(`/marketplace/bookings/${bookingId}/messages/read`, { method: 'PATCH' }).catch(() => undefined);
        }
      });

      socket.on('message:read', (event: { bookingId?: string; messageIds?: string[]; readAt?: string }) => {
        if (!active || event.bookingId !== bookingId || !event.readAt) return;
        chatStore.markMessagesRead(bookingId, event.messageIds ?? [], event.readAt);
      });
    }

    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user, bookingId, flushQueue, performSendMessage, request]);

  // Optimistic UI Send Flow
  const handleSendMessage = useCallback(async () => {
    const text = draft.trim();
    if ((!text && !pendingAttachments.length) || !bookingId || !user) return;
    hapticLight();

    const attachmentIds = pendingAttachments.map((item) => item.id);

    // 1. Instantly enqueue optimistic message in UI with 'sending' state
    const tempId = enqueueOptimisticMessage(text, user.id, attachmentIds);

    // Clear composer inputs immediately
    setDraft('');
    setPendingAttachments([]);
    setChatError('');
    Keyboard.dismiss();

    // 2. Attempt delivery
    try {
      const created = await performSendMessage(text, attachmentIds);
      confirmMessageSent(tempId, created);
    } catch (err: unknown) {
      // 3. Mark failed/queued on network drop; will auto-flush on reconnect
      markMessageFailed(tempId, err instanceof Error ? err.message : 'Network error');
    }
  }, [bookingId, confirmMessageSent, draft, enqueueOptimisticMessage, markMessageFailed, pendingAttachments, performSendMessage, user]);

  // Voice Note Send Flow
  const handleSendVoiceNote = useCallback(async (voiceNote: { fileUrl: string; durationSeconds: number; audioBlob?: Blob }) => {
    if (!bookingId || !user) return;
    hapticLight();
    try {
      let finalAudioUrl = voiceNote.fileUrl;
      if (voiceNote.audioBlob) {
        const form = new FormData();
        form.append('file', voiceNote.audioBlob, 'voice-note.webm');
        form.append('durationSeconds', String(voiceNote.durationSeconds));
        const res = await upload<{ fileUrl: string }>(`/marketplace/bookings/${bookingId}/voice-note`, form);
        if (res?.fileUrl) finalAudioUrl = res.fileUrl;
      }
      const tempId = enqueueOptimisticMessage('Voice note', user.id, [], {
        messageType: 'voice',
        audioUrl: finalAudioUrl,
        audioDurationSeconds: voiceNote.durationSeconds,
      });
      const created = await request<ChatMessage>(`/marketplace/bookings/${bookingId}/messages`, {
        method: 'POST',
        body: {
          text: 'Voice note',
          messageType: 'voice',
          audioUrl: finalAudioUrl,
          audioDurationSeconds: voiceNote.durationSeconds,
        },
      });
      confirmMessageSent(tempId, created);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Could not send voice note.');
    }
  }, [bookingId, confirmMessageSent, enqueueOptimisticMessage, request, upload, user]);

  // Retry sending a previously failed message
  const handleRetryMessage = useCallback(async (message: ChatMessage) => {
    if (!message.tempId) return;
    try {
      chatStore.getState();
      const created = await performSendMessage(message.text, message.attachments?.map((a) => a.id) || []);
      confirmMessageSent(message.tempId, created);
    } catch (err: unknown) {
      markMessageFailed(message.tempId, err instanceof Error ? err.message : 'Retry failed');
    }
  }, [confirmMessageSent, markMessageFailed, performSendMessage]);

  const generateStudyGuide = useCallback(async () => {
    try {
      const partner = user?.activeRole === 'student' ? accountBooking?.tutorName : accountBooking?.learnerName;
      const transcript = messages
        .slice()
        .reverse()
        .map((m) => {
          const sender = m.senderId === user?.id ? 'You' : (partner ?? 'Partner');
          const text = (m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<p><strong>${sender}:</strong> ${text}</p>`;
        })
        .join('');
      const attachmentList = messages
        .flatMap((m) => m.attachments || [])
        .map((a) => `<li>${a.fileName}</li>`)
        .join('');
      const html = `
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>body{font-family:Helvetica,Arial,sans-serif;padding:24;color:#1B4332;} h1{color:#1B4332;} p{line-height:1.5;} code,pre{background:#F8F9FA;padding:4px;border-radius:6px;}</style></head>
          <body>
            <h1>Juniper Study Guide</h1>
            <p><strong>Subject:</strong> ${accountBooking?.subject ?? ''}</p>
            <p><strong>Partner:</strong> ${partner ?? ''}</p>
            <h2>Transcript</h2>
            ${transcript}
            ${attachmentList ? `<h2>Attachments</h2><ul>${attachmentList}</ul>` : ''}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save study guide' });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not generate study guide.');
    }
  }, [messages, user?.id, accountBooking]);

  const addAttachment = useCallback(async () => {
    if (!bookingId || uploading || pendingAttachments.length >= 5) return;
    try {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (selected.canceled || !selected.assets?.[0]) return;
      const asset = selected.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setChatError('Choose a file smaller than 10 MB.');
        return;
      }
      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, asset.name);
      else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);

      setUploading(true);
      setChatError('');
      const uploaded = await upload<MessageAttachment>(`/marketplace/bookings/${bookingId}/messages/attachments`, form);
      setPendingAttachments((current) => current.some((item) => item.id === uploaded.id) ? current : [...current, uploaded].slice(0, 5));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'That file could not be attached.');
    } finally {
      setUploading(false);
    }
  }, [bookingId, pendingAttachments.length, upload, uploading]);

  const openAttachment = useCallback(async (attachment: MessageAttachment) => {
    if (!bookingId) return;
    try {
      const { blob } = await download(`/marketplace/bookings/${bookingId}/messages/attachments/${attachment.id}`);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        link.rel = 'noopener';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const safeName = attachment.fileName.replace(/[\\/\0-\x1f]/g, '_').slice(0, 120) || 'learning-file';
        const file = new File(Paths.cache, `${attachment.id}-${safeName}`);
        file.write(new Uint8Array(await blob.arrayBuffer()));
        await Sharing.shareAsync(file.uri, { mimeType: attachment.mimeType, dialogTitle: 'Open learning attachment' });
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'This attachment could not be opened.');
    }
  }, [bookingId, download]);

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <AccountMessageBubble
        message={item}
        outgoing={item.senderId === user?.id}
        onOpenAttachment={openAttachment}
        onRetry={handleRetryMessage}
      />
    ),
    [handleRetryMessage, openAttachment, user?.id],
  );

  if (!user) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <PageHeader title="Your conversation" onBack={() => router.back()} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Sign in to open a shared conversation.</Text>
      </View>
    );
  }

  if (!accountBooking) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <PageHeader title="Your conversation" onBack={() => router.back()} />
        {chatError ? (
          <Text style={[styles.notFoundText, { color: colors.destructive }]}>{chatError}</Text>
        ) : (
          <ChatSkeleton />
        )}
      </View>
    );
  }

  const partnerName = user.activeRole === 'student' ? accountBooking.tutorName : accountBooking.learnerName;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.headerWrap, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <View style={styles.chatHeader}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          </HapticPressable>
          <View style={[styles.accountAvatar, { backgroundColor: colors.leaf }]}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.tutorHeaderCopy}>
            <Text style={[styles.tutorName, { color: colors.foreground }]}>{partnerName}</Text>
            <Text style={[styles.tutorSubject, { color: colors.mutedForeground }]}>
              {accountBooking.subject} · shared session
            </Text>
          </View>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Open session space"
            onPress={() => router.push(`/workroom/${bookingId}` as never)}
            style={[styles.pdfButton, { backgroundColor: colors.leaf, borderColor: colors.primary, marginRight: 6 }]}
          >
            <Ionicons name="folder-open-outline" size={17} color={colors.primary} />
          </HapticPressable>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Generate study guide PDF"
            onPress={() => void generateStudyGuide()}
            style={[styles.pdfButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          </HapticPressable>

          {/* Connection status pill */}
          {!isOnline ? (
            <View style={[styles.offlineStatusBadge, { backgroundColor: colors.warning }]}>
              <View style={[styles.offlineDot, { backgroundColor: colors.warningBorder }]} />
              <Text style={[styles.offlineStatusText, { color: colors.warningForeground }]}>Offline</Text>
            </View>
          ) : isFlushing ? (
            <View style={[styles.offlineStatusBadge, { backgroundColor: colors.leaf }]}>
              <Ionicons name="sync" size={12} color={colors.primary} />
              <Text style={[styles.offlineStatusText, { color: colors.primary }]}>Syncing</Text>
            </View>
          ) : null}
        </View>

        {/* Offline notice for reconnecting learners and tutors */}
        {!isOnline ? (
          <View style={[styles.offlineBanner, { backgroundColor: colors.warning, borderColor: colors.warningBorder }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warningForeground} />
            <Text style={[styles.offlineBannerText, { color: colors.warningForeground }]}>
              Your connection is unstable. Messages are saved locally and will send as soon as you reconnect.
            </Text>
          </View>
        ) : (
          <View style={[styles.chatNotice, { backgroundColor: colors.pale }]}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
            <Text style={[styles.chatNoticeText, { color: colors.primary }]}>
              A private conversation between you and your session partner.
            </Text>
          </View>
        )}

        {chatError ? <Text style={[styles.chatError, { color: colors.destructive }]}>{chatError}</Text> : null}
      </View>

      {/* Epic 3: Shared Resources Zone */}
      <ResourcesZone bookingId={bookingId} isCollapsible />

      {messages.length ? (
        <FlatList
          inverted
          data={orderedMessages}
          keyExtractor={(item) => item.tempId || item.id}
          renderItem={renderMessage}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messageList}
        />
      ) : (
        <View style={styles.emptyChat}>
          <View style={[styles.emptyChatIcon, { backgroundColor: colors.leaf }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.emptyChatTitle, { color: colors.foreground }]}>A good session starts with a hello.</Text>
          <Text style={[styles.emptyChatCopy, { color: colors.mutedForeground }]}>
            Share what you would like to work on together.
          </Text>
        </View>
      )}

      {/* Message Composer */}
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
          <View style={styles.pendingFiles}>
            {pendingAttachments.map((file) => (
              <HapticPressable
                key={file.id}
                onPress={() => setPendingAttachments((current) => current.filter((item) => item.id !== file.id))}
                style={[styles.pendingFile, { backgroundColor: colors.leaf }]}
              >
                <Ionicons name="document-outline" size={13} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.pendingFileText, { color: colors.primary }]}>
                  {file.fileName}
                </Text>
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </HapticPressable>
            ))}
          </View>
        ) : null}

        {pendingAttachments.some((f) => f.mimeType?.startsWith('image/')) ? (
          <HapticPressable
            onPress={() => router.push('/ai-chat' as never)}
            style={[styles.aiHint, { backgroundColor: colors.leaf }]}
          >
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={[styles.aiHintText, { color: colors.primary }]}>Want AI to explain this image? Tap here</Text>
          </HapticPressable>
        ) : null}

        <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Attach a PDF or image"
            disabled={uploading || pendingAttachments.length >= 5}
            onPress={() => uploadSheetRef.current?.present()}
            style={styles.attachButton}
          >
            <Ionicons name={uploading ? 'hourglass-outline' : 'attach-outline'} size={19} color={colors.primary} />
          </HapticPressable>

          {/* Epic 3: Voice Note Recorder Button */}
          <VoiceNoteRecorder
            bookingId={bookingId}
            onSendVoiceMessage={handleSendVoiceNote}
            disabled={uploading}
          />

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={isOnline ? "Write a note…" : "Type offline message…"}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.composerInput, { color: colors.foreground }]}
            multiline
            maxLength={5000}
            accessibilityLabel="Write a message"
          />

          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim() && !pendingAttachments.length}
            onPress={() => void handleSendMessage()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: draft.trim() || pendingAttachments.length ? colors.primary : colors.muted,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={19}
              color={draft.trim() || pendingAttachments.length ? colors.primaryForeground : colors.mutedForeground}
            />
          </HapticPressable>
        </View>
      </View>
      <FileUploadSheet
        sheetRef={uploadSheetRef}
        uploading={uploading}
        pendingAttachments={pendingAttachments}
        onPickFile={() => void addAttachment()}
        onRemoveFile={(id) => setPendingAttachments((current) => current.filter((item) => item.id !== id))}
      />
    </KeyboardAvoidingView>
  );
}

function RichMessage({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$)/g).filter(Boolean);
  return (
    <View style={{ gap: 4 }}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          return (
            <View key={index} style={{ alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(127,127,127,0.10)' }}>
              <Text selectable style={{ color, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
                {math}
              </Text>
            </View>
          );
        }
        return (
          <Markdown
            key={index}
            style={{
              body: { color, fontFamily: 'Inter_400Regular', fontSize: 14 },
              code_inline: { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, paddingHorizontal: 4 },
              code_block: { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 8 },
            }}
          >
            {part}
          </Markdown>
        );
      })}
    </View>
  );
}

const AccountMessageBubble = memo(function AccountMessageBubble({
  message,
  outgoing,
  onOpenAttachment,
  onRetry,
}: {
  message: ChatMessage;
  outgoing: boolean;
  onOpenAttachment: (attachment: MessageAttachment) => void;
  onRetry: (message: ChatMessage) => void;
}) {
  const colors = useColors();
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const isSending = message.status === 'sending';
  const isQueued = message.status === 'queued';
  const isFailed = message.status === 'failed';

  return (
    <View style={[styles.messageItem, outgoing ? styles.outgoingMessage : styles.incomingMessage]}>
      <View
        style={[
          styles.messageBubble,
          outgoing
            ? {
                backgroundColor: isFailed ? colors.card : colors.primary,
                borderColor: isFailed ? colors.destructive : 'transparent',
                borderWidth: isFailed ? 1.5 : 0,
                opacity: isSending || isQueued ? 0.75 : 1,
              }
            : {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
              },
          outgoing ? styles.outgoingBubble : styles.incomingBubble,
        ]}
      >
        {message.messageType === 'voice' || message.audioUrl ? (
          <WorkroomAudioPlayer
            audioUrl={message.audioUrl || ''}
            durationSeconds={message.audioDurationSeconds || 0}
            outgoing={outgoing}
          />
        ) : message.text ? (
          <RichMessage
            text={message.text}
            color={outgoing && !isFailed ? colors.primaryForeground : colors.foreground}
          />
        ) : null}

        {message.attachments?.map((attachment) => (
          <HapticPressable
            key={attachment.id}
            accessibilityRole="button"
            onPress={() => onOpenAttachment(attachment)}
            style={[
              styles.sharedFile,
              { backgroundColor: outgoing && !isFailed ? 'rgba(255,255,255,0.16)' : colors.leaf },
            ]}
          >
            <Ionicons
              name="document-attach-outline"
              size={16}
              color={outgoing && !isFailed ? colors.primaryForeground : colors.primary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.sharedFileText,
                { color: outgoing && !isFailed ? colors.primaryForeground : colors.primary },
              ]}
            >
              {attachment.fileName}
            </Text>
            <Ionicons
              name="download-outline"
              size={15}
              color={outgoing && !isFailed ? colors.primaryForeground : colors.primary}
            />
          </HapticPressable>
        ))}
      </View>

      {/* Metadata & Status indicator */}
      <View style={styles.metaRow}>
        <Text style={[styles.messageTime, { color: colors.mutedForeground }]}>{time}</Text>

        {outgoing ? (
          isSending ? (
            <View style={styles.statusIndicator}>
              <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Sending…</Text>
            </View>
          ) : isQueued ? (
            <View style={styles.statusIndicator}>
              <Ionicons name="cloud-offline-outline" size={11} color={colors.warningForeground} />
              <Text style={[styles.statusText, { color: colors.warningForeground }]}>Queued</Text>
            </View>
          ) : isFailed ? (
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Retry sending message"
              onPress={() => onRetry(message)}
              style={styles.retryButton}
            >
              <Ionicons name="alert-circle" size={12} color={colors.destructive} />
              <Text style={[styles.retryText, { color: colors.destructive }]}>Failed · Tap to retry</Text>
            </HapticPressable>
          ) : (
            message.readAt && (
              <View style={styles.statusIndicator}>
                <Ionicons name="checkmark-done" size={12} color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.primary }]}>Seen</Text>
              </View>
            )
          )
        ) : null}
      </View>
    </View>
  );
}

);

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, paddingHorizontal: 22 },
  notFoundText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  chatHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  backButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  tutorHeaderCopy: { flex: 1 },
  tutorName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  tutorSubject: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },
  offlineStatusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  offlineDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  offlineStatusText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  offlineBanner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
    padding: 11,
  },
  offlineBannerText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 16,
  },
  chatNotice: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 12, padding: 12 },
  chatNoticeText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
  messageList: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  messageItem: { marginBottom: 14 },
  messageBubble: {
    borderRadius: 20,
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginRight: 3,
  },
  messageTime: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  statusIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  retryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  retryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  outgoingMessage: { alignItems: 'flex-end' },
  incomingMessage: { alignItems: 'flex-start' },
  outgoingBubble: { borderBottomRightRadius: 6 },
  incomingBubble: { borderBottomLeftRadius: 6 },
  accountAvatar: { alignItems: 'center', borderRadius: 16, height: 42, justifyContent: 'center', width: 42 },
  chatError: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  emptyChat: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 36 },
  emptyChatIcon: { alignItems: 'center', borderRadius: 20, height: 52, justifyContent: 'center', marginBottom: 14, width: 52 },
  emptyChatTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5, textAlign: 'center' },
  emptyChatCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  composerWrap: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  composer: {
    alignItems: 'flex-end',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 8,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  composerInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, maxHeight: 120, minHeight: 44, paddingHorizontal: 12, paddingVertical: 11 },
  sendButton: { alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  attachButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 36 },
  aiHint: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 6, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 6 },
  aiHintText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  pdfButton: { alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  pendingFiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  pendingFile: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 6, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7 },
  pendingFileText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, maxWidth: 190 },
  sharedFile: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 7, marginTop: 8, maxWidth: 240, paddingHorizontal: 9, paddingVertical: 8 },
  sharedFileText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
