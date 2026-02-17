import AsyncStorage from '@react-native-async-storage/async-storage';
import { TorBoxNotification } from '@/types/torbox';

const APP_NOTIFICATIONS_KEY = '@tordeck_app_notifications';
const MAX_NOTIFICATIONS = 200;

export async function getAppNotifications(): Promise<TorBoxNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(APP_NOTIFICATIONS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TorBoxNotification => {
      return !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.message === 'string' && typeof item.createdAt === 'string';
    });
  } catch (err) {
    console.warn('[AppNotifications] Failed to read local notifications:', err);
    return [];
  }
}

export async function appendAppNotification(payload: Omit<TorBoxNotification, 'id' | 'createdAt'> & Partial<Pick<TorBoxNotification, 'id' | 'createdAt'>>): Promise<TorBoxNotification> {
  const notification: TorBoxNotification = {
    id: payload.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: payload.title,
    message: payload.message,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    read: payload.read ?? false,
  };

  const existing = await getAppNotifications();
  const next = [notification, ...existing].slice(0, MAX_NOTIFICATIONS);
  await AsyncStorage.setItem(APP_NOTIFICATIONS_KEY, JSON.stringify(next));
  return notification;
}

