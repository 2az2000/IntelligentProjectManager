import { apiClient } from '@/lib/api-client';
import type { ActivityEntry } from '../types';

export const activityApi = {
  list: async (taskId: number): Promise<ActivityEntry[]> =>
    (await apiClient.get<ActivityEntry[]>(`/tasks/${taskId}/activity`)).data,
};
