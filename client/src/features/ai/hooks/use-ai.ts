import { useMutation } from '@tanstack/react-query';
import { aiApi, type EnrichTaskInput } from '../api/ai.api';
import type { ProjectDoc, TaskEnrichment } from '../types';

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
