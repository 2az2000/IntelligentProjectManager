import { apiClient } from '@/lib/api-client';
import type { TaskPriority } from '../types';

/** Grouping options of the list view; saved with the view so it reopens as it was left. */
export const LIST_GROUPS = ['none', 'assignee', 'priority', 'status'] as const;
export type ListGroup = (typeof LIST_GROUPS)[number];

/** Mirrors the API's validated filter payload (§4 saved views). */
export interface SavedViewFilters {
  search?: string;
  priority?: TaskPriority;
  /** `0` = unassigned. */
  assigneeId?: number;
  groupBy?: ListGroup;
}

export interface SavedView {
  id: number;
  projectId: number;
  name: string;
  filters: SavedViewFilters;
  createdAt: string;
  updatedAt: string;
}

export const savedViewsApi = {
  list: async (projectId: number): Promise<SavedView[]> =>
    (await apiClient.get<SavedView[]>(`/projects/${projectId}/views`)).data,
  create: async (projectId: number, input: { name: string; filters: SavedViewFilters }): Promise<SavedView> =>
    (await apiClient.post<SavedView>(`/projects/${projectId}/views`, input)).data,
  update: async (
    projectId: number,
    viewId: number,
    input: { name?: string; filters?: SavedViewFilters },
  ): Promise<SavedView> =>
    (await apiClient.patch<SavedView>(`/projects/${projectId}/views/${viewId}`, input)).data,
  remove: async (projectId: number, viewId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/views/${viewId}`);
  },
};
