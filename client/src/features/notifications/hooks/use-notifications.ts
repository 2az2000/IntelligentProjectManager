'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { qk } from '@/lib/query-keys';
import { getRealtimeSocket } from '@/features/realtime';
import { notificationsApi } from '../api/notifications.api';
import type { Notification } from '../types';

const LIST_LIMIT = 20;

export function useNotifications(limit = LIST_LIMIT) {
  return useQuery({
    queryKey: qk.notifications.list(limit),
    queryFn: () => notificationsApi.list(limit),
  });
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
 *
 * Digest toasts get a "view" action that opens the report modal through the
 * `onOpenDigest` callback (kept in a ref so the socket subscription is stable).
 */
export function useNotificationEvents(options?: { onOpenDigest?: () => void }) {
  const queryClient = useQueryClient();
  const t = useTranslations('Notifications');
  const onOpenDigest = useRef(options?.onOpenDigest);
  onOpenDigest.current = options?.onOpenDigest;

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const onNew = (event: { type: string }) => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      const key = `toast.${event.type}` as Parameters<typeof t>[0];
      const message = t.has(key) ? t(key) : t('generic');
      if (event.type === 'DAILY_DIGEST' && onOpenDigest.current) {
        toast.info(message, {
          action: { label: t('digest.view'), onClick: () => onOpenDigest.current?.() },
        });
        return;
      }
      toast.info(message);
    };

    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [queryClient, t]);
}

export type { Notification };
