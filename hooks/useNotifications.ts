import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { torboxApi } from '@/services/torbox-api';
import { TorBoxNotification } from '@/types/torbox';
import { useAuth } from '@/hooks/useAuth';
import { getAppNotifications } from '@/hooks/useAppNotifications';

const DISMISSED_NOTIFICATIONS_KEY = '@tordeck_dismissed_notifications';

export function useNotifications() {
  const { isConnected } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadDismissed = async () => {
      try {
        const stored = await AsyncStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDismissedIds(parsed.filter((id): id is string => typeof id === 'string'));
          }
        }
      } catch (err) {
        console.warn('[Notifications] Failed to load dismissed notifications:', err);
      }
    };

    loadDismissed();
  }, []);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const [remote, local] = await Promise.all([
        isConnected ? torboxApi.getNotifications() : Promise.resolve([]),
        getAppNotifications(),
      ]);

      const merged = [...local, ...remote]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const uniqueById = new Map<string, TorBoxNotification>();
      for (const item of merged) {
        if (!uniqueById.has(item.id)) {
          uniqueById.set(item.id, item);
        }
      }

      return Array.from(uniqueById.values());
    },
    enabled: true,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
  });

  const notifications = useMemo(() => {
    const all = notificationsQuery.data ?? [];
    if (!dismissedIds.length) return all;
    return all.filter(notification => !dismissedIds.includes(notification.id));
  }, [notificationsQuery.data, dismissedIds]);

  const mostRecent = notifications[0] ?? null;

  const clearNotifications = useCallback(async () => {
    const ids = (notificationsQuery.data ?? []).map((item: TorBoxNotification) => item.id);
    const newDismissedIds = Array.from(new Set([...dismissedIds, ...ids]));
    setDismissedIds(newDismissedIds);
    await AsyncStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(newDismissedIds));
  }, [dismissedIds, notificationsQuery.data]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    const newDismissedIds = Array.from(new Set([...dismissedIds, notificationId]));
    setDismissedIds(newDismissedIds);
    await AsyncStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(newDismissedIds));
  }, [dismissedIds]);

  return {
    notifications,
    mostRecent,
    isLoading: notificationsQuery.isLoading,
    isFetching: notificationsQuery.isFetching,
    error: notificationsQuery.error,
    refetch: notificationsQuery.refetch,
    clearNotifications,
    dismissNotification,
  };
}
