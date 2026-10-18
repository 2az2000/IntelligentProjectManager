/**
 * Mirrors TaskDto in docs/02-API-CONTRACT.md.
 *
 * These four are the *analytics buckets* (`Task.status`). The board columns a task actually sits
 * in are the project's own `statusKey`s — see features/statuses.
 */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  TASK_STATUSES.includes(value as TaskStatus);

export interface UserSummary {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface Task {
  id: number;
  projectId: number;
  project: { id: number; name: string };
  parentId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** The project's workflow column this task sits in (`ProjectStatus.key`). */
  statusKey: string;
  priority: TaskPriority;
  position: number;
  tags: string[];
  points: number | null;
  /** Effort estimate in working hours; null = not estimated (drives CPM scheduling). */
  estimateHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  author: UserSummary;
  /** Lead assignee; null when the task has no owner. */
  assignee: UserSummary | null;
  /** Lead first, then co-assignees — everyone who shares the task. */
  assignees: UserSummary[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail extends Task {
  subtasks: Task[];
}

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
