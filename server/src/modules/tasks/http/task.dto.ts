import type { TaskDateConflict, TaskDetailDto, TaskDto } from '@managesys/contracts';
import type { TaskDetailView, TaskView } from '../application/task.repository';

// The response shape is shared with the client (`@managesys/contracts`), so the board and the
// API cannot disagree about a field.
export type { TaskDetailDto, TaskDto };
/** Kept for callers that name the conflict row rather than the shared type. */
export type TaskDateConflictDto = TaskDateConflict;

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
