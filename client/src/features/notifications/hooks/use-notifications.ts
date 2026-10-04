'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { qk } from '@/lib/query-keys';
import { getRealtimeSocket } from '@/features/realtime';
import { notificationsApi } from '../api/notifications.api';
import type { Notification } from '../types';

const LIST_LIMIT = 20;

export function useNotifications(limit = LIST_LIMIT) {
  return useQuery({ queryKey: qk.notifications.list(limit), queryFn: () => notificationsApi.list(limit) });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: notificationsApi.unreadCount,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.notifications.all }),
        queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
      ]),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

/**
 * Subscribes to the private `notification:new` room event: refreshes the bell
 * and shows a toast. Mount once next to the bell (navbar). The socket must be
 * connected — it joins our user room automatically on the server.
 */
export function useNotificationEvents() {
  const queryClient = useQueryClient();
  const t = useTranslations('Notifications');

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const onNew = (event: { type: string }) => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      const key = `toast.${event.type}` as Parameters<typeof t>[0];
      toast.info(t.has(key) ? t(key) : t('generic'));
    };

    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [queryClient, t]);
}

export type { Notification };
