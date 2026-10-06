import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  commentApi,
  taskApi,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '../api/task.api';
import { byPosition, type DropPlan } from '../lib/ordering';
import type { Task } from '../types';

/** Everything derived from tasks: lists, details, dashboard, project stats and team workload. */
function invalidateTaskViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    queryClient.invalidateQueries({ queryKey: qk.projects.all }),
    queryClient.invalidateQueries({ queryKey: qk.team }),
  ]);
}

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

export function useProjectTasks(projectId: number) {
  return useQuery({
    queryKey: qk.tasks.byProject(projectId),
    queryFn: () => taskApi.listByProject(projectId),
    enabled: validId(projectId),
    select: (tasks) => [...tasks].sort(byPosition),
  });
}

export function useTask(taskId: number | null) {
  return useQuery({
    queryKey: qk.tasks.detail(taskId ?? 0),
    queryFn: () => taskApi.get(taskId!),
    enabled: validId(taskId),
  });
}

export function useMyTasks(includeDone = false) {
  return useQuery({ queryKey: qk.tasks.mine(includeDone), queryFn: () => taskApi.mine(includeDone) });
}

export function useCalendarTasks(from: string, to: string, scope: 'mine' | 'all') {
  return useQuery({
    queryKey: qk.tasks.calendar(from, to, scope),
    queryFn: () => taskApi.calendar(from, to, scope),
    placeholderData: (previous) => previous,
  });
}

export function useCreateTask(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => taskApi.create(projectId, input),
    onSuccess: () => invalidateTaskViews(queryClient),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: number; input: UpdateTaskInput }) =>
      taskApi.update(taskId, input),
    onSuccess: (task) => {
      queryClient.setQueryData(qk.tasks.detail(task.id), (old: object | undefined) =>
        old ? { ...old, ...task } : old,
      );
      return invalidateTaskViews(queryClient);
    },
  });
}

/** Drag & drop: optimistically applies the planned status/position; rolls back on failure. */
export function useMoveTask(projectId: number) {
  const queryClient = useQueryClient();
  const queryKey = qk.tasks.byProject(projectId);

  return useMutation({
    mutationFn: ({ taskId, plan }: { taskId: number; plan: DropPlan }) =>
      taskApi.move(taskId, { status: plan.status, beforeId: plan.beforeId, afterId: plan.afterId }),
    onMutate: async ({ taskId, plan }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (tasks) =>
        tasks?.map((t) => (t.id === taskId ? { ...t, status: plan.status, position: plan.position } : t)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => invalidateTaskViews(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => taskApi.remove(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.removeQueries({ queryKey: qk.tasks.detail(taskId) });
      return invalidateTaskViews(queryClient);
    },
  });
}

// ---- §11 recycling bin ------------------------------------------------------------------

export function useTrashTasks(projectId: number) {
  return useQuery({
    queryKey: qk.tasks.trash(projectId),
    queryFn: () => taskApi.trash(projectId),
    enabled: validId(projectId),
  });
}

export function useRestoreTask(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => taskApi.restore(projectId, taskId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.tasks.trash(projectId) }),
        invalidateTaskViews(queryClient),
      ]),
  });
}

// ---- comments ----------------------------------------------------------------------------

export function useComments(taskId: number) {
  return useQuery({ queryKey: qk.comments.byTask(taskId), queryFn: () => commentApi.list(taskId) });
}

function useCommentMutation<TVars>(taskId: number, fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.comments.byTask(taskId) }),
        queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
      ]),
  });
}

export const useAddComment = (taskId: number) =>
  useCommentMutation(taskId, (body: string) => commentApi.create(taskId, body));
export const useEditComment = (taskId: number) =>
  useCommentMutation(taskId, ({ id, body }: { id: number; body: string }) => commentApi.update(id, body));
export const useDeleteComment = (taskId: number) =>
  useCommentMutation(taskId, (id: number) => commentApi.remove(id));
