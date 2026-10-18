import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { qk } from '@/lib/query-keys';
import { useErrorMessage } from '@/hooks/use-error-message';
import { labelApi } from '../api/label.api';
import type { LabelInput } from '../types';

/** The project's label vocabulary — shared by the settings manager and the task picker. */
export function useProjectLabels(projectId: number) {
  return useQuery({
    queryKey: qk.labels.byProject(projectId),
    queryFn: () => labelApi.list(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
}

function useInvalidateLabels(projectId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.labels.byProject(projectId) }),
      // A rename rewrites tags on this project's tasks, so task lists are stale too.
      queryClient.invalidateQueries({ queryKey: qk.tasks.byProject(projectId) }),
    ]);
}

export function useCreateLabel(projectId: number) {
  const invalidate = useInvalidateLabels(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: (input: LabelInput) => labelApi.create(projectId, input),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateLabel(projectId: number) {
  const invalidate = useInvalidateLabels(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ labelId, patch }: { labelId: number; patch: Partial<LabelInput> }) =>
      labelApi.update(projectId, labelId, patch),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteLabel(projectId: number) {
  const invalidate = useInvalidateLabels(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: (labelId: number) => labelApi.remove(projectId, labelId),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}
