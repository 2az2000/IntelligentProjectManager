import { useMutation } from '@tanstack/react-query';
import { aiApi, type EnrichTaskInput } from '../api/ai.api';
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

/** No cache needed: AI previews are one-shot, expensive calls the user triggers explicitly. */
export function useEnrichTask(projectId: number) {
  return useMutation({
    mutationFn: (input: EnrichTaskInput): Promise<TaskEnrichment> => aiApi.enrichTask(projectId, input),
  });
}

export function useProjectDoc() {
  return useMutation({
    mutationFn: (projectId: number): Promise<ProjectDoc> => aiApi.projectDoc(projectId),
  });
}

/** §2 stand-up report from the user's own activity. */
export function useStandup(projectId: number) {
  return useMutation({
    mutationFn: (): Promise<AiMarkdown> => aiApi.standup(projectId),
  });
}

/** §2 summarize a long comment thread. */
export function useSummarizeThread() {
  return useMutation({
    mutationFn: (taskId: number): Promise<AiMarkdown> => aiApi.summarizeThread(taskId),
  });
}

/** §2 tag suggestions drawn from the project's existing vocabulary. */
export function useSuggestTags(projectId: number) {
  return useMutation({
    mutationFn: (input: EnrichTaskInput): Promise<TagSuggestions> => aiApi.suggestTags(projectId, input),
  });
}

/** §AI PRD → task drafts (preview; the dialog applies them through the normal create API). */
export function useBreakdown(projectId: number) {
  return useMutation({
    mutationFn: (prd: string): Promise<BreakdownResult> => aiApi.breakdown(projectId, prd),
  });
}

/** §AI project chat — one mutation per turn; the dialog owns the transcript. */
export function useProjectChat(projectId: number) {
  return useMutation({
    mutationFn: (messages: ChatTurn[]): Promise<ProjectChatResult> => aiApi.chat(projectId, messages),
  });
}

/** §AI weekly summary, generated on demand (the Monday job reuses the same server method). */
export function useWeeklySummary(projectId: number) {
  return useMutation({
    mutationFn: (): Promise<WeeklySummary> => aiApi.weeklySummary(projectId),
  });
}

export function useBackfillEmbeddings(projectId: number) {
  return useMutation({
    mutationFn: () => aiApi.backfillEmbeddings(projectId),
  });
}
