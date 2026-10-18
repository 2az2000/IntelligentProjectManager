import { apiClient } from '@/lib/api-client';
import type { Label, LabelInput } from '../types';

export const labelApi = {
  /** GET /projects/:projectId/labels — the project's vocabulary, alphabetical. */
  list: async (projectId: number): Promise<Label[]> =>
    (await apiClient.get<Label[]>(`/projects/${projectId}/labels`)).data,
  create: async (projectId: number, input: LabelInput): Promise<Label> =>
    (await apiClient.post<Label>(`/projects/${projectId}/labels`, input)).data,
  update: async (projectId: number, labelId: number, patch: Partial<LabelInput>): Promise<Label> =>
    (await apiClient.patch<Label>(`/projects/${projectId}/labels/${labelId}`, patch)).data,
  remove: async (projectId: number, labelId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/labels/${labelId}`);
  },
};
