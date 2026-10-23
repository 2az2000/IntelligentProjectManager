import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  commentApi,
  taskApi,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '../api/task.api';
import { byPosition, type DropPlan } from '../lib/ordering';
import { toggleReactionList } from '../lib/reactions';
import type { Comment, Task, UserSummary } from '../types';

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
    onSuccess: (task, { input }) => {
      const { warnings, ...rest } = task;
      // §4 Productivity — a manual date that contradicts a dependency. Kept in its own cache
      // entry rather than a mutation callback: the sheet body remounts on `updatedAt`, so a
      // per-call `onSuccess` would be dropped before the banner could show it.
      if (warnings?.length || input.startDate !== undefined || input.dueDate !== undefined) {
        queryClient.setQueryData(qk.taskWarnings(task.id), warnings ?? []);
      }
      queryClient.setQueryData(qk.tasks.detail(task.id), (old: object | undefined) =>
        old ? { ...old, ...rest } : old,
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
      taskApi.move(taskId, {
        statusKey: plan.statusKey,
        beforeId: plan.beforeId,
        afterId: plan.afterId,
      }),
    onMutate: async ({ taskId, plan }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      // The category (`status`) lands with the server answer; the board groups by `statusKey`.
      queryClient.setQueryData<Task[]>(queryKey, (tasks) =>
        tasks?.map((t) =>
          t.id === taskId ? { ...t, statusKey: plan.statusKey, position: plan.position } : t,
        ),
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

/**
 * Reactions update optimistically: a tap must feel instant. The server answers with the grouped
 * list, so the cache is replaced by the authoritative version on success and rolled back on
 * failure — realtime then keeps other tabs in sync.
 */
export function useToggleReaction(taskId: number) {
  const queryClient = useQueryClient();
  const key = qk.comments.byTask(taskId);
  return useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: number; emoji: string; me: UserSummary }) =>
      commentApi.toggleReaction(commentId, emoji),
    onMutate: async ({ commentId, emoji, me }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((comment) =>
          comment.id === commentId
            ? { ...comment, reactions: toggleReactionList(comment.reactions, emoji, me) }
            : comment,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (result) =>
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((comment) =>
          comment.id === result.commentId
            ? { ...comment, reactions: result.reactions }
            : comment,
        ),
      ),
  });
}
