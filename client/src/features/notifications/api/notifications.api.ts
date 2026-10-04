import { apiClient } from '@/lib/api-client';
import type { Notification } from '../types';

export const notificationsApi = {
  list: async (limit = 20): Promise<Notification[]> =>
    (await apiClient.get<Notification[]>('/notifications', { params: { limit } })).data,
  unreadCount: async (): Promise<number> =>
    (await apiClient.get<{ count: number }>('/notifications/unread-count')).data.count,
  markRead: async (notificationId: number): Promise<void> => {
    await apiClient.post(`/notifications/${notificationId}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await apiClient.post('/notifications/read-all');
  },
};
