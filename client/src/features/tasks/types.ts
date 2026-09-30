/** Mirrors TaskDto in docs/02-API-CONTRACT.md */
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
  priority: TaskPriority;
  position: number;
  tags: string[];
  points: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  author: UserSummary;
  assignee: UserSummary | null;
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

export interface Comment {
  id: number;
  taskId: number;
  body: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
}

export const isOverdue = (task: Pick<Task, 'dueDate' | 'status'>, now = new Date()) =>
  !!task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE';
