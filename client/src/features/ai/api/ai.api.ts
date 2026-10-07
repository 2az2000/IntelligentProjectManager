import { apiClient } from '@/lib/api-client';
import type { AiMarkdown, EstimateSuggestion, ProjectDoc, TagSuggestions, TaskEnrichment } from '../types';

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

  /** §2 POST /projects/:projectId/ai/estimate — few-shot estimate from closed tasks. */
  estimate: async (projectId: number, input: EnrichTaskInput): Promise<EstimateSuggestion> =>
    (await apiClient.post<EstimateSuggestion>(`/projects/${projectId}/ai/estimate`, input)).data,

  /** §2 GET /projects/:projectId/ai/standup — yesterday/today/blockers. */
  standup: async (projectId: number): Promise<AiMarkdown> =>
    (await apiClient.get<AiMarkdown>(`/projects/${projectId}/ai/standup`)).data,

  /** §2 POST /tasks/:taskId/ai/summarize-thread — long comment thread summary. */
  summarizeThread: async (taskId: number): Promise<AiMarkdown> =>
    (await apiClient.post<AiMarkdown>(`/tasks/${taskId}/ai/summarize-thread`, {})).data,

  /** §2 POST /projects/:projectId/ai/suggest-tags — tags from the project's vocabulary. */
  suggestTags: async (projectId: number, input: EnrichTaskInput): Promise<TagSuggestions> =>
    (await apiClient.post<TagSuggestions>(`/projects/${projectId}/ai/suggest-tags`, input)).data,
};
