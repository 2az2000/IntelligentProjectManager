/** Mirrors the notification DTO in server/src/modules/notifications/notifications.module.ts */
export const NOTIFICATION_TYPES = ['ASSIGNED', 'COMMENTED', 'MENTIONED', 'DUE_REMINDER', 'DAILY_DIGEST'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface NotificationTask {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
}

export interface Notification {
  id: number;
  type: NotificationType;
  actor: NotificationUser | null;
  task: NotificationTask | null;
  read: boolean;
  createdAt: string;
}
