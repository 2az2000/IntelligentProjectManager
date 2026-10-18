import type { TaskDetailView, TaskView, UserSummary } from '../application/task.repository';
import type { TaskPriority, TaskStatus } from '../domain/task.entity';

export interface TaskDto {
  id: number;
  projectId: number;
  project: { id: number; name: string };
  parentId: number | null;
  title: string;
  description: string | null;
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
}

export interface TaskDetailDto extends TaskDto {
  subtasks: TaskDto[];
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toTaskDto(task: TaskView): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    project: task.project,
    parentId: task.parentId,
    title: task.title,
    description: task.description,
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
  };
}

export const toTaskDetailDto = (task: TaskDetailView): TaskDetailDto => ({
  ...toTaskDto(task),
  subtasks: task.subtasks.map(toTaskDto),
});
