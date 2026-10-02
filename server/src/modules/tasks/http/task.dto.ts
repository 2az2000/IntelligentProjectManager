import type { TaskDetailView, TaskView, UserSummary } from '../application/task.repository';
import type { TaskPriority, TaskStatus } from '../domain/task.entity';

export interface TaskDto {
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
  estimateHours: number | null;
  completedAt: string | null;
  author: UserSummary;
  assignee: UserSummary | null;
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
