import { apiClient } from '@/lib/api-client';
import type {
  AiMarkdown,
  BreakdownResult,
  ChatTurn,
  ProjectChatResult,
  ProjectDoc,
  TagSuggestions,
  TaskEnrichment,
  WeeklySummary,
} from '../types';

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

  /** §2 GET /projects/:projectId/ai/standup — yesterday/today/blockers. */
  standup: async (projectId: number): Promise<AiMarkdown> =>
    (await apiClient.get<AiMarkdown>(`/projects/${projectId}/ai/standup`)).data,

  /** §2 POST /tasks/:taskId/ai/summarize-thread — long comment thread summary. */
  summarizeThread: async (taskId: number): Promise<AiMarkdown> =>
    (await apiClient.post<AiMarkdown>(`/tasks/${taskId}/ai/summarize-thread`, {})).data,

  /** §2 POST /projects/:projectId/ai/suggest-tags — tags from the project's vocabulary. */
  suggestTags: async (projectId: number, input: EnrichTaskInput): Promise<TagSuggestions> =>
    (await apiClient.post<TagSuggestions>(`/projects/${projectId}/ai/suggest-tags`, input)).data,

  /** §AI POST /projects/:projectId/ai/breakdown — PRD to previewed tasks (writes nothing). */
  breakdown: async (projectId: number, prd: string): Promise<BreakdownResult> =>
    (await apiClient.post<BreakdownResult>(`/projects/${projectId}/ai/breakdown`, { prd })).data,

  /** §AI POST /projects/:projectId/ai/chat — read-only project Q&A. */
  chat: async (projectId: number, messages: ChatTurn[]): Promise<ProjectChatResult> =>
    (await apiClient.post<ProjectChatResult>(`/projects/${projectId}/ai/chat`, { messages })).data,

  /** §AI POST /projects/:projectId/ai/weekly-summary — Monday report, on demand. */
  weeklySummary: async (projectId: number): Promise<WeeklySummary> =>
    (await apiClient.post<WeeklySummary>(`/projects/${projectId}/ai/weekly-summary`, {})).data,

  /** §AI POST /projects/:projectId/ai/embeddings/backfill — embed existing tasks. */
  backfillEmbeddings: async (
    projectId: number,
  ): Promise<{ embedded: number; failed: number; total: number }> =>
    (await apiClient.post<{ embedded: number; failed: number; total: number }>(
      `/projects/${projectId}/ai/embeddings/backfill`,
      {},
    )).data,
};
