import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type MessageStatus = 'sending' | 'queued' | 'sent' | 'failed';

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type MessageAttachment = ChatAttachment;

export interface ChatMessage {
  id: string;
  tempId?: string;
  senderId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
  attachments?: ChatAttachment[];
  messageType?: 'text' | 'voice';
  audioUrl?: string;
  audioDurationSeconds?: number;
  status?: MessageStatus;
  error?: string;
}

export interface QueuedMessage {
  tempId: string;
  bookingId: string;
  text: string;
  attachmentIds: string[];
  createdAt: string;
  retryCount: number;
}

interface ChatState {
  messagesByBooking: Record<string, ChatMessage[]>;
  offlineQueue: QueuedMessage[];
  isOnline: boolean;
  isConnecting: boolean;
  isFlushing: boolean;
}

const STORAGE_KEY_QUEUE = 'juniper_chat_offline_queue_v1';
const storageKeyForBooking = (bookingId: string) => `juniper_chat_cache_${bookingId}_v1`;

// Central in-memory state for offline-first chat
let state: ChatState = {
  messagesByBooking: {},
  offlineQueue: [],
  isOnline: true,
  isConnecting: false,
  isFlushing: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function updateState(updater: (prev: ChatState) => Partial<ChatState>) {
  state = { ...state, ...updater(state) };
  emitChange();
}

// Persist offline queue to AsyncStorage
async function persistQueue(queue: QueuedMessage[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  } catch (err) {
    console.warn('[JuniperChat] Failed to persist offline queue:', err);
  }
}

// Persist conversation messages to AsyncStorage
async function persistBookingMessages(bookingId: string, messages: ChatMessage[]) {
  try {
    // Keep at most 200 messages in offline storage per conversation
    const trimmed = messages.slice(-200);
    await AsyncStorage.setItem(storageKeyForBooking(bookingId), JSON.stringify(trimmed));
  } catch (err) {
    console.warn(`[JuniperChat] Failed to persist messages for ${bookingId}:`, err);
  }
}

export const chatStore = {
  getState: () => state,

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setOnlineStatus: (isOnline: boolean) => {
    updateState(() => ({ isOnline, isConnecting: !isOnline }));
  },

  setConnectingStatus: (isConnecting: boolean) => {
    updateState(() => ({ isConnecting }));
  },

  // Load cached messages and offline queue from AsyncStorage on screen mount
  initialize: async (bookingId: string) => {
    try {
      const [queueData, cachedMessagesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_QUEUE),
        AsyncStorage.getItem(storageKeyForBooking(bookingId)),
      ]);

      const queue: QueuedMessage[] = queueData ? JSON.parse(queueData) : [];
      const cachedMessages: ChatMessage[] = cachedMessagesData ? JSON.parse(cachedMessagesData) : [];

      updateState((prev) => {
        // Merge queued messages that belong to this booking into the list if not already present
        const currentList = prev.messagesByBooking[bookingId] || cachedMessages;
        return {
          offlineQueue: queue,
          messagesByBooking: {
            ...prev.messagesByBooking,
            [bookingId]: currentList,
          },
        };
      });
    } catch (err) {
      console.warn(`[JuniperChat] Error initializing storage for ${bookingId}:`, err);
    }
  },

  // Merge authoritative server messages with any local pending/queued messages
  setServerMessages: (bookingId: string, serverMessages: ChatMessage[]) => {
    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];
      const pendingLocal = currentList.filter(
        (m) => (m.status === 'sending' || m.status === 'queued' || m.status === 'failed') && m.tempId
      );

      // Server IDs map
      const serverIds = new Set(serverMessages.map((m) => m.id));

      // Filter out pending that may have been confirmed on server
      const stillPending = pendingLocal.filter((local) => {
        return !serverMessages.some((srv) => srv.text === local.text && Math.abs(new Date(srv.createdAt).getTime() - new Date(local.createdAt).getTime()) < 10000);
      });

      const merged = [
        ...serverMessages.map((m) => ({ ...m, status: 'sent' as MessageStatus })),
        ...stillPending,
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      void persistBookingMessages(bookingId, merged);

      return {
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: merged,
        },
      };
    });
  },

  // Receive a message from Socket.IO realtime event
  addIncomingMessage: (bookingId: string, message: ChatMessage) => {
    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];

      // Check if message is already in list
      if (currentList.some((m) => m.id === message.id)) {
        return {};
      }

      // Check if this replaces an optimistic local message with the same text from current user
      let matchedTempId: string | undefined;
      const filtered = currentList.filter((m) => {
        if (m.status === 'sending' && m.senderId === message.senderId && m.text === message.text) {
          matchedTempId = m.tempId;
          return false;
        }
        return true;
      });

      const updatedList = [...filtered, { ...message, status: 'sent' as MessageStatus }].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // If matched, remove from queue
      let nextQueue = prev.offlineQueue;
      if (matchedTempId) {
        nextQueue = prev.offlineQueue.filter((q) => q.tempId !== matchedTempId);
        void persistQueue(nextQueue);
      }

      void persistBookingMessages(bookingId, updatedList);

      return {
        offlineQueue: nextQueue,
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: updatedList,
        },
      };
    });
  },

  markMessagesRead: (bookingId: string, messageIds: string[], readAt: string) => {
    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];
      const idSet = new Set(messageIds);

      const updated = currentList.map((m) => (idSet.has(m.id) ? { ...m, readAt } : m));
      void persistBookingMessages(bookingId, updated);

      return {
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: updated,
        },
      };
    });
  },

  // Optimistic UI: Add message instantly in 'sending' state
  enqueueOptimisticMessage: (
    bookingId: string,
    text: string,
    senderId: string,
    attachmentIds: string[] = [],
    extra?: { messageType?: 'text' | 'voice'; audioUrl?: string; audioDurationSeconds?: number }
  ): string => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg: ChatMessage = {
      id: tempId,
      tempId,
      senderId,
      text,
      messageType: extra?.messageType ?? 'text',
      audioUrl: extra?.audioUrl,
      audioDurationSeconds: extra?.audioDurationSeconds,
      createdAt: nowIso,
      readAt: null,
      status: state.isOnline ? 'sending' : 'queued',
    };

    const queueItem: QueuedMessage = {
      tempId,
      bookingId,
      text,
      attachmentIds,
      createdAt: nowIso,
      retryCount: 0,
    };

    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];
      const nextList = [...currentList, optimisticMsg];
      const nextQueue = [...prev.offlineQueue, queueItem];

      void persistBookingMessages(bookingId, nextList);
      void persistQueue(nextQueue);

      return {
        offlineQueue: nextQueue,
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: nextList,
        },
      };
    });

    return tempId;
  },

  // Confirm server delivery
  confirmMessageSent: (bookingId: string, tempId: string, serverMsg: ChatMessage) => {
    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];
      const nextList = currentList.map((m) => {
        if (m.tempId === tempId || m.id === tempId) {
          return { ...serverMsg, status: 'sent' as MessageStatus };
        }
        return m;
      });

      const nextQueue = prev.offlineQueue.filter((q) => q.tempId !== tempId);
      void persistBookingMessages(bookingId, nextList);
      void persistQueue(nextQueue);

      return {
        offlineQueue: nextQueue,
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: nextList,
        },
      };
    });
  },

  // Mark message as failed with retry affordance
  markMessageFailed: (bookingId: string, tempId: string, error?: string) => {
    updateState((prev) => {
      const currentList = prev.messagesByBooking[bookingId] || [];
      const nextList = currentList.map((m) => {
        if (m.tempId === tempId || m.id === tempId) {
          return { ...m, status: 'failed' as MessageStatus, error: error || 'Failed to deliver' };
        }
        return m;
      });

      void persistBookingMessages(bookingId, nextList);

      return {
        messagesByBooking: {
          ...prev.messagesByBooking,
          [bookingId]: nextList,
        },
      };
    });
  },

  // Flush offline queue when Socket.IO reconnects or 4G restores
  flushQueue: async (
    bookingId: string,
    sendFn: (text: string, attachmentIds: string[]) => Promise<ChatMessage>
  ) => {
    if (state.isFlushing) return;
    const itemsToFlush = state.offlineQueue.filter((item) => item.bookingId === bookingId);
    if (!itemsToFlush.length) return;

    updateState(() => ({ isFlushing: true }));

    for (const item of itemsToFlush) {
      try {
        // Update optimistic state to 'sending'
        updateState((prev) => {
          const list = prev.messagesByBooking[bookingId] || [];
          return {
            messagesByBooking: {
              ...prev.messagesByBooking,
              [bookingId]: list.map((m) => (m.tempId === item.tempId ? { ...m, status: 'sending' } : m)),
            },
          };
        });

        const created = await sendFn(item.text, item.attachmentIds);
        chatStore.confirmMessageSent(bookingId, item.tempId, created);
      } catch (err) {
        console.warn(`[JuniperChat] Failed to flush queued message ${item.tempId}:`, err);
        chatStore.markMessageFailed(bookingId, item.tempId, 'Network connection dropped');
        // Stop on first failure to preserve ordering
        break;
      }
    }

    updateState(() => ({ isFlushing: false }));
  },
};

// React hook for consuming chat state with automatic reactivity
export function useChatStore(bookingId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return chatStore.getState().messagesByBooking[bookingId] || [];
  });
  const [isOnline, setIsOnline] = useState(() => chatStore.getState().isOnline);
  const [isConnecting, setIsConnecting] = useState(() => chatStore.getState().isConnecting);
  const [isFlushing, setIsFlushing] = useState(() => chatStore.getState().isFlushing);

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(() => {
      const current = chatStore.getState();
      setMessages(current.messagesByBooking[bookingId] || []);
      setIsOnline(current.isOnline);
      setIsConnecting(current.isConnecting);
      setIsFlushing(current.isFlushing);
    });

    // Initial load from AsyncStorage
    void chatStore.initialize(bookingId);

    return () => {
      unsubscribe();
    };
  }, [bookingId]);

  return {
    messages,
    isOnline,
    isConnecting,
    isFlushing,
    enqueueOptimisticMessage: useCallback(
      (
        text: string,
        senderId: string,
        attachmentIds?: string[],
        extra?: { messageType?: 'text' | 'voice'; audioUrl?: string; audioDurationSeconds?: number }
      ) =>
        chatStore.enqueueOptimisticMessage(bookingId, text, senderId, attachmentIds, extra),
      [bookingId]
    ),
    confirmMessageSent: useCallback(
      (tempId: string, serverMsg: ChatMessage) =>
        chatStore.confirmMessageSent(bookingId, tempId, serverMsg),
      [bookingId]
    ),
    markMessageFailed: useCallback(
      (tempId: string, error?: string) =>
        chatStore.markMessageFailed(bookingId, tempId, error),
      [bookingId]
    ),
    flushQueue: useCallback(
      (sendFn: (text: string, attachmentIds: string[]) => Promise<ChatMessage>) =>
        chatStore.flushQueue(bookingId, sendFn),
      [bookingId]
    ),
  };
}
