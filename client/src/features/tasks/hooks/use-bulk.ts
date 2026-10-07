import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface BulkResult {
  updated: number;
  skipped: { taskId: number; reason: string }[];
}

export interface UnassignedTask {
  id: number;
  title: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  createdAt: string;
}

/** §4 bulk update — one request for up to 100 tasks. */
export function useBulkUpdate(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ids: number[];
      patch: { status?: string; priority?: string; assigneeId?: number | null; tags?: string[] };
    }): Promise<BulkResult> =>
      (await apiClient.post<BulkResult>(`/projects/${projectId}/tasks/bulk`, input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tasks.all });
      queryClient.invalidateQueries({ queryKey: qk.projects.all });
    },
  });
}

/** §34 unassigned tasks — the ownership handover report. */
export function useUnassignedTasks(projectId: number) {
  return useQuery({
    queryKey: qk.unassigned(projectId),
    queryFn: async (): Promise<UnassignedTask[]> =>
      (await apiClient.get<UnassignedTask[]>(`/projects/${projectId}/tasks/unassigned`)).data,
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
}
