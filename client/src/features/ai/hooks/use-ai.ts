import { useMutation } from '@tanstack/react-query';
import { aiApi, type EnrichTaskInput } from '../api/ai.api';
import type { AiMarkdown, EstimateSuggestion, ProjectDoc, TagSuggestions, TaskEnrichment } from '../types';

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

/** §2 few-shot estimate from the team's own closed tasks. */
export function useAiEstimate(projectId: number) {
  return useMutation({
    mutationFn: (input: EnrichTaskInput): Promise<EstimateSuggestion> => aiApi.estimate(projectId, input),
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
