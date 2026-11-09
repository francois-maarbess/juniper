import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
// expo-device not required; use Platform check instead
import Constants from 'expo-constants';
import { getApiOrigin, getCurrentAccessToken } from '@/lib/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreferences {
  sessionReminders: boolean;
  newMessages: boolean;
  bountyUpdates: boolean;
  enrollmentUpdates: boolean;
  reviewEndorsements: boolean;
  aiStudyGuides: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  sessionReminders: true,
  newMessages: true,
  bountyUpdates: true,
  enrollmentUpdates: true,
  reviewEndorsements: true,
  aiStudyGuides: true,
};

const PREFS_KEY = 'juniper_notification_prefs';

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

export async function setNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const current = await getNotificationPreferences();
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    // Register with backend
    const origin = getApiOrigin();
    const accessToken = getCurrentAccessToken();
    if (origin && accessToken) {
      await fetch(`${origin}/api/marketplace/push-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ token, platform: Platform.OS }),
      }).catch(() => {});
    }
    return token;
  } catch {
    return null;
  }
}

export async function scheduleSessionReminder(sessionId: string, title: string, scheduledAt: string): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.sessionReminders) return;
  const trigger = new Date(scheduledAt);
  trigger.setMinutes(trigger.getMinutes() - 15);
  if (trigger.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Session starting soon', body: `${title} starts in 15 minutes.`, data: { type: 'session_reminder', sessionId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export async function sendLocalNotification(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data || {} },
    trigger: null,
  });
}