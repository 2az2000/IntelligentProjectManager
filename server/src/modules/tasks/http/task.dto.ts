import type { TaskDateConflict } from '../../scheduling';
import type { TaskDetailView, TaskView, UserSummary } from '../application/task.repository';
import type { TaskPriority, TaskStatus } from '../domain/task.entity';

/** Mirrors TaskDateConflict in modules/scheduling (kept structural so the modules stay decoupled). */
export interface TaskDateConflictDto {
  code: 'DEPENDENCY_DATE_CONFLICT';
  direction: 'predecessor' | 'successor';
  relatedTaskId: number;
  relatedTaskTitle: string;
  conflictDays: number;
}

export interface TaskDto {
  id: number;
  projectId: number;
  project: { id: number; name: string };
  parentId: number | null;
  title: string;
  description: string | null;
  /** §4 rich text body (sanitized on write); `description` is its plain-text twin. */
  descriptionHtml: string | null;
  /** Analytics bucket of `statusKey` (TODO | IN_PROGRESS | REVIEW | DONE). */
  status: TaskStatus;
  /** The project's workflow column the task sits in (`ProjectStatus.key`). */
  statusKey: string;
  priority: TaskPriority;
  position: number;
  tags: string[];
  points: number | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  completedAt: string | null;
  author: UserSummary;
  /** Lead assignee (`assigneeId`); null when nobody owns the task. */
  assignee: UserSummary | null;
  /** Lead first, then co-assignees — everyone who shares the task. */
  assignees: UserSummary[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  /** Only present on PATCH responses: non-blocking clashes between a manual date and dependencies. */
  warnings?: TaskDateConflictDto[];
}

export interface TaskDetailDto extends TaskDto {
  subtasks: TaskDto[];
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toTaskDto(task: TaskView & { warnings?: TaskDateConflict[] }): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    project: task.project,
    parentId: task.parentId,
    title: task.title,
    description: task.description,
    descriptionHtml: task.descriptionHtml,
    status: task.status,
    statusKey: task.statusKey,
    priority: task.priority,
    position: task.position,
    tags: task.tags,
    points: task.points,
    startDate: iso(task.startDate),
    dueDate: iso(task.dueDate),
    estimateHours: task.estimateHours,
    completedAt: iso(task.completedAt),
    author: task.author,
    assignee: task.assignee,
    assignees: task.assignees,
    subtaskCount: task.subtaskCount,
    doneSubtaskCount: task.doneSubtaskCount,
    commentCount: task.commentCount,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    ...(task.warnings && task.warnings.length > 0 && { warnings: task.warnings }),
  };
}

export const toTaskDetailDto = (task: TaskDetailView): TaskDetailDto => ({
  ...toTaskDto(task),
  subtasks: task.subtasks.map(toTaskDto),
});
