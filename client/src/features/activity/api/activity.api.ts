import { apiClient } from '@/lib/api-client';
import type { ActivityPage } from '../types';

/** Rows per request — the sheet shows one page and reveals more on demand. */
export const ACTIVITY_PAGE_SIZE = 8;

export const activityApi = {
  list: async (taskId: number, cursor: number | null = null): Promise<ActivityPage> =>
    (
      await apiClient.get<ActivityPage>(`/tasks/${taskId}/activity`, {
        params: { limit: ACTIVITY_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      })
    ).data,
};
