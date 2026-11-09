import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'juniper_cache_';
const QUEUE_KEY = 'juniper_offline_queue';

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {}
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return null;
}

export async function cacheRemove(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(CACHE_PREFIX + key); } catch {}
}

// Offline message queue
export interface QueuedMessage {
  id: string;
  bookingId: string;
  text: string;
  attachmentIds: string[];
  createdAt: string;
}

export async function enqueueMessage(msg: QueuedMessage): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedMessage[] = raw ? JSON.parse(raw) : [];
    queue.push(msg);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function dequeueMessages(): Promise<QueuedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedMessage[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.removeItem(QUEUE_KEY);
    return queue;
  } catch { return []; }
}

export async function getQueueLength(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedMessage[] = raw ? JSON.parse(raw) : [];
    return queue.length;
  } catch { return 0; }
}