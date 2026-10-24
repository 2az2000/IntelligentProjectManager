import { TASK_STATUSES, type TaskDto, type UserSummary } from '@managesys/contracts';
import type { TaskDetailDto, TaskPriority, TaskStatus } from '@managesys/contracts';

/**
 * Task vocabulary and response shapes come from `@managesys/contracts` — the same file the server
 * validates and serializes with. Analytics buckets (`status`) vs. board columns (`statusKey`):
 * the latter are the project's own, see features/statuses.
 */
export { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus, type TaskPriority } from '@managesys/contracts';
export type { TaskDateConflict, UserSummary } from '@managesys/contracts';

export type Task = TaskDto;
export type TaskDetail = TaskDetailDto;

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  TASK_STATUSES.includes(value as TaskStatus);

export interface TaskFilters {
  search?: string;
  assigneeId?: number;
  priority?: TaskPriority;
}

/** One emoji on a comment, pre-grouped by the server: everyone who reacted with it. */
export interface CommentReaction {
  emoji: string;
  users: UserSummary[];
}

export interface Comment {
  id: number;
  taskId: number;
  body: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  /** Only emoji someone actually used, in a stable order. */
  reactions: CommentReaction[];
}

export const isOverdue = (task: Pick<Task, 'dueDate' | 'status'>, now = new Date()) =>
  !!task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE';
