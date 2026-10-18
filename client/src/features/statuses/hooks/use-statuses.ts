import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { qk } from '@/lib/query-keys';
import { useErrorMessage } from '@/hooks/use-error-message';
import { statusApi, type StatusPatch } from '../api/status.api';
import type { StatusInput } from '../types';

/** The project's workflow columns — shared by the board, the selects and the settings manager. */
export function useProjectStatuses(projectId: number) {
  return useQuery({
    queryKey: qk.statuses.byProject(projectId),
    queryFn: () => statusApi.list(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
}

function useInvalidateStatuses(projectId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.statuses.byProject(projectId) }),
      // Re-colouring/re-bucketing a column rewrites its tasks, so task lists are stale too.
      queryClient.invalidateQueries({ queryKey: qk.tasks.byProject(projectId) }),
    ]);
}

export function useCreateStatus(projectId: number) {
  const invalidate = useInvalidateStatuses(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: (input: StatusInput) => statusApi.create(projectId, input),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateStatus(projectId: number) {
  const invalidate = useInvalidateStatuses(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ statusId, patch }: { statusId: number; patch: StatusPatch }) =>
      statusApi.update(projectId, statusId, patch),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useReorderStatuses(projectId: number) {
  const invalidate = useInvalidateStatuses(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: (keys: string[]) => statusApi.reorder(projectId, keys),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteStatus(projectId: number) {
  const invalidate = useInvalidateStatuses(projectId);
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ statusId, moveToKey }: { statusId: number; moveToKey?: string }) =>
      statusApi.remove(projectId, statusId, moveToKey),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}
