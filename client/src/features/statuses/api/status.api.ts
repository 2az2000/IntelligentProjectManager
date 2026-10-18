import { apiClient } from '@/lib/api-client';
import type { ProjectStatus, StatusCategory, StatusInput } from '../types';

export interface StatusPatch {
  label?: string;
  color?: string;
  category?: StatusCategory;
}

export const statusApi = {
  /** GET /projects/:projectId/statuses — the workflow columns in board order. */
  list: async (projectId: number): Promise<ProjectStatus[]> =>
    (await apiClient.get<ProjectStatus[]>(`/projects/${projectId}/statuses`)).data,
  create: async (projectId: number, input: StatusInput): Promise<ProjectStatus> =>
    (await apiClient.post<ProjectStatus>(`/projects/${projectId}/statuses`, input)).data,
  update: async (
    projectId: number,
    statusId: number,
    patch: StatusPatch,
  ): Promise<ProjectStatus> =>
    (await apiClient.patch<ProjectStatus>(`/projects/${projectId}/statuses/${statusId}`, patch))
      .data,
  /** Rewrites the whole order; the body must list every key of the project exactly once. */
  reorder: async (projectId: number, keys: string[]): Promise<ProjectStatus[]> =>
    (await apiClient.post<ProjectStatus[]>(`/projects/${projectId}/statuses/reorder`, { keys }))
      .data,
  remove: async (projectId: number, statusId: number, moveToKey?: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/statuses/${statusId}`, {
      params: moveToKey ? { moveToKey } : undefined,
    });
  },
};
