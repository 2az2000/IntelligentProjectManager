'use client';

import {
  AlarmClock,
  AtSign,
  Bell,
  CheckCheck,
  Mail,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useTaskSheet } from '@/features/tasks/hooks/use-task-sheet';
import { formatRelative } from '@/lib/format';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationEvents,
  useNotifications,
  useUnreadCount,
} from '../hooks/use-notifications';
import type { Notification, NotificationType } from '../types';

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  ASSIGNED: UserPlus,
  COMMENTED: MessageSquare,
  MENTIONED: AtSign,
  DUE_REMINDER: AlarmClock,
  DAILY_DIGEST: Mail,
};

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const { openTask } = useTaskSheet();
  const { data: unread = 0 } = useUnreadCount();
  const { data: notifications = [], isPending } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useNotificationEvents();

  const open = (notification: Notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.task) openTask(notification.task.id);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('title')}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              data-testid="unread-badge"
              className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t('title')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="size-3.5" aria-hidden />
            {t('markAllRead')}
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto" role="list" aria-label={t('title')}>
          {isPending ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('loading')}</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            notifications.map((notification) => {
              const Icon = TYPE_ICON[notification.type] ?? Bell;
              return (
                <button
                  key={notification.id}
                  type="button"
                  role="listitem"
                  onClick={() => open(notification)}
                  className={`flex w-full items-start gap-2 border-b px-3 py-2 text-start last:border-b-0 hover:bg-muted/60 ${
                    notification.read ? 'opacity-70' : 'bg-primary/5'
                  }`}
                >
                  {notification.actor ? (
                    <UserAvatar user={notification.actor} className="size-7 text-xs" />
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs leading-5">
                      {t(`types.${notification.type}`, {
                        actor: notification.actor?.name ?? t('system'),
                        task: notification.task?.title ?? '',
                        project: notification.task?.projectName ?? '',
                      })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(notification.createdAt, locale)}
                    </span>
                  </span>
                  {!notification.read && (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
