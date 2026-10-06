import { apiClient } from '@/lib/api-client';
import type { ProjectDoc, TaskEnrichment } from '../types';

export interface EnrichTaskInput {
  title: string;
  description?: string;
}

export const aiApi = {
  /** POST /projects/:projectId/ai/enrich-task — preview only, writes nothing. */
  enrichTask: async (projectId: number, input: EnrichTaskInput): Promise<TaskEnrichment> =>
    (await apiClient.post<TaskEnrichment>(`/projects/${projectId}/ai/enrich-task`, input)).data,
  /** POST /projects/:projectId/ai/project-doc — full project documentation as Markdown. */
  projectDoc: async (projectId: number): Promise<ProjectDoc> =>
    (await apiClient.post<ProjectDoc>(`/projects/${projectId}/ai/project-doc`, {})).data,
};
