import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { schedulingApi, type CreateDependencyInput } from '../api/scheduling.api';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

/** Schedule changes reflect on every view: tasks got dates, dashboards counted them. */
function invalidateScheduleViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.schedule.all }),
    queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    queryClient.invalidateQueries({ queryKey: qk.projects.all }),
  ]);
}

export function useSchedule(projectId: number) {
  return useQuery({
    queryKey: qk.schedule.byProject(projectId),
    queryFn: () => schedulingApi.getSchedule(projectId),
    enabled: validId(projectId),
  });
}

export function useTaskSchedule(taskId: number | null) {
  return useQuery({
    queryKey: qk.schedule.byTask(taskId ?? 0),
    queryFn: () => schedulingApi.getTaskSchedule(taskId!),
    enabled: validId(taskId),
  });
}

/** Fills empty (or past) start/due dates from the CPM schedule. MEMBER+ only. */
export function useApplySchedule(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => schedulingApi.applySchedule(projectId),
    onSuccess: () => invalidateScheduleViews(queryClient),
  });
}

export function useDependencies(projectId: number) {
  return useQuery({
    queryKey: qk.dependencies.byProject(projectId),
    queryFn: () => schedulingApi.listDependencies(projectId),
    enabled: validId(projectId),
  });
}

export function useCreateDependency(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDependencyInput) => schedulingApi.createDependency(projectId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.dependencies.byProject(projectId) }),
        queryClient.invalidateQueries({ queryKey: qk.schedule.all }),
      ]),
  });
}

export function useDeleteDependency(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ predecessorId, successorId }: { predecessorId: number; successorId: number }) =>
      schedulingApi.removeDependency(projectId, predecessorId, successorId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.dependencies.byProject(projectId) }),
        queryClient.invalidateQueries({ queryKey: qk.schedule.all }),
      ]),
  });
}
