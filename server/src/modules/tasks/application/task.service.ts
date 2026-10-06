import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import type { TaskFieldChange } from '../../../shared/realtime/bus';
import { hasRole, type ProjectRole } from '../../projects';
import { POSITION_STEP, positionBetween } from '../domain/position';
import { Task, type NewTask, type TaskChanges, type TaskStatus } from '../domain/task.entity';
import type {
  AssignedTaskFilters,
  PositionInfo,
  TaskDetailView,
  TaskFilters,
  TaskRepository,
  TaskView,
} from './task.repository';
import type { TaskProps } from '../domain/task.entity';

/** What tasks need from the projects module. */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
  hasRole(projectId: number, userId: number, required: ProjectRole): Promise<boolean>;
  projectIdsForUser(userId: number): Promise<number[]>;
}

export type CreateTaskInput = Omit<NewTask, 'authorId'>;

export interface MoveTaskInput {
  status: TaskStatus;
  /** Task that will sit directly above the moved task (same column). */
  beforeId?: number;
  /** Task that will sit directly below the moved task (same column). */
  afterId?: number;
}

const taskNotFound = () => new NotFoundError('TASK_NOT_FOUND', 'Task not found');

export interface TaskChangedHook {
  /** Returning a promise lets the caller await activity/notifications before responding. */
  (event: {
    actorId: number;
    projectId: number;
    taskId: number;
    kind: 'created' | 'updated' | 'moved' | 'deleted';
    changes?: TaskFieldChange[];
    /** New assignee — should receive an in-app notification. */
    notifyUserIds?: number[];
  }): void | Promise<void>;
}

/** Fields tracked in the activity log / realtime payload. */
const TRACKED_FIELDS = ['title', 'status', 'priority', 'assigneeId', 'startDate', 'dueDate', 'points', 'estimateHours'] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export class TaskService {
  /** Wired in the composition root (activity log, realtime broadcast, reminder jobs). */
  readonly hooks: { onChanged: TaskChangedHook | null } = { onChanged: null };

  constructor(
    private readonly tasks: TaskRepository,
    private readonly access: ProjectAccess,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(userId: number, projectId: number, filters: TaskFilters = {}): Promise<TaskView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.tasks.list(projectId, filters);
  }

  async get(userId: number, taskId: number): Promise<TaskDetailView> {
    const task = await this.tasks.getDetail(taskId);
    if (!task) throw taskNotFound();
    await this.access.assertRole(task.projectId, userId, 'VIEWER');
    return task;
  }

  async create(userId: number, input: CreateTaskInput): Promise<TaskView> {
    await this.access.assertRole(input.projectId, userId, 'MEMBER');
    const parentId = input.parentId ?? null;
    if (parentId !== null) await this.assertValidParent(parentId, input.projectId);
    if (input.assigneeId != null) await this.assertAssignable(input.projectId, input.assigneeId);

    const status = input.status ?? 'TODO';
    const last = await this.tasks.lastPosition(input.projectId, parentId, status);
    const position = (last ?? 0) + POSITION_STEP;
    const created = await this.tasks.create(
      Task.validateNew({ ...input, authorId: userId }, position, this.clock()),
    );
    await this.fire({ actorId: userId, projectId: input.projectId, taskId: created.id, kind: 'created' });
    return created;
  }

  async update(userId: number, taskId: number, changes: TaskChanges): Promise<TaskView> {
    const task = await this.load(taskId);
    await this.access.assertRole(task.projectId, userId, 'MEMBER');
    if (changes.assigneeId != null) await this.assertAssignable(task.projectId, changes.assigneeId);

    const snapshot = task.toJSON();
    const diff = this.diffChanges(snapshot, changes);
    const patch = task.applyChanges(changes, this.clock());
    // Changing status through an edit moves the card to the end of the new column.
    // Compare against the snapshot — applyChanges mutates the entity in place.
    if (changes.status !== undefined && changes.status !== snapshot.status) {
      const last = await this.tasks.lastPosition(task.projectId, task.parentId, changes.status);
      patch.position = (last ?? 0) + POSITION_STEP;
    }
    const updated = await this.tasks.update(taskId, patch);
    const assigneeChanged = changes.assigneeId != null && changes.assigneeId !== snapshot.assigneeId;
    await this.fire({
      actorId: userId,
      projectId: updated.projectId,
      taskId: updated.id,
      kind: 'updated',
      changes: diff,
      ...(assigneeChanged && { notifyUserIds: [changes.assigneeId!] }),
    });
    return updated;
  }

  /** Moves a task to a column and between two neighbours (drag & drop). */
  async move(userId: number, taskId: number, input: MoveTaskInput): Promise<TaskView> {
    const task = await this.load(taskId);
    await this.access.assertRole(task.projectId, userId, 'MEMBER');

    let position = await this.computePosition(task, input);
    if (position === null) {
      await this.tasks.rebalance(task.projectId, task.parentId, input.status);
      position = (await this.computePosition(task, input)) ?? POSITION_STEP;
    }
    const previousStatus = task.status; // applyChanges mutates the entity in place
    const patch = task.applyChanges({ status: input.status }, this.clock());
    const moved = await this.tasks.update(taskId, { ...patch, status: input.status, position });
    await this.fire({
      actorId: userId,
      projectId: moved.projectId,
      taskId: moved.id,
      kind: 'moved',
      changes: [{ field: 'status', oldValue: previousStatus, newValue: input.status }],
    });
    return moved;
  }

  async remove(userId: number, taskId: number): Promise<void> {
    const task = await this.load(taskId);
    const role = await this.access.assertRole(task.projectId, userId, 'MEMBER');
    if (task.authorId !== userId && !hasRole(role, 'ADMIN')) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', 'Only the author or a project admin can delete this task');
    }
    await this.tasks.softDelete(taskId, this.clock());
    await this.fire({ actorId: userId, projectId: task.projectId, taskId, kind: 'deleted' });
  }

  /** §11 recycling bin: recently deleted top-level tasks of a project. */
  async listTrash(userId: number, projectId: number): Promise<TaskView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.tasks.listDeleted(projectId);
  }

  /** §11 restores a soft-deleted task (author or admin, like delete). */
  async restore(userId: number, taskId: number): Promise<TaskView> {
    const task = await this.tasks.findByIdAny(taskId);
    if (!task) throw taskNotFound();
    const role = await this.access.assertRole(task.projectId, userId, 'MEMBER');
    if (task.authorId !== userId && !hasRole(role, 'ADMIN')) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', 'Only the author or a project admin can restore this task');
    }
    const restored = await this.tasks.restore(taskId);
    if (!restored) throw taskNotFound();
    await this.fire({ actorId: userId, projectId: task.projectId, taskId, kind: 'updated' });
    return restored;
  }

  /** Tasks assigned to the user across all their projects (My Tasks, calendar). */
  async listForUser(userId: number, filters: AssignedTaskFilters = {}): Promise<TaskView[]> {
    const projectIds = await this.access.projectIdsForUser(userId);
    if (projectIds.length === 0) return [];
    return this.tasks.listForUser(userId, projectIds, filters);
  }

  /** For other modules (comments): ensures access to the task's project and returns it. */
  async assertTaskAccess(
    userId: number,
    taskId: number,
    required: ProjectRole,
  ): Promise<{ projectId: number; role: ProjectRole }> {
    const task = await this.load(taskId);
    const role = await this.access.assertRole(task.projectId, userId, required);
    return { projectId: task.projectId, role };
  }

  unassignUser(projectId: number, userId: number): Promise<void> {
    return this.tasks.unassignUser(projectId, userId);
  }

  // ---- helpers ----------------------------------------------------------------------------

  /** Announces a committed mutation to the composition root (activity/realtime/jobs). */
  private async fire(event: Parameters<TaskChangedHook>[0]): Promise<void> {
    try {
      // A promise result is awaited so side effects land before the HTTP response;
      // rejections and sync throws are logged, never propagated to the mutation.
      await this.hooks.onChanged?.(event);
    } catch (err) {
      // Hooks must never break the mutation that produced them.
      logger.warn({ err }, 'task onChanged hook failed');
    }
  }

  /** Field-level diff for the activity log, restricted to tracked fields. */
  private diffChanges(snapshot: TaskProps, changes: TaskChanges): TaskFieldChange[] {
    return TRACKED_FIELDS.filter((field) => changes[field] !== undefined).map((field) => ({
      field,
      oldValue: formatValue(snapshot[field as keyof TaskProps]),
      newValue: formatValue(changes[field as TrackedField]),
    }));
  }

  private async load(taskId: number): Promise<Task> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw taskNotFound();
    return task;
  }

  private async assertValidParent(parentId: number, projectId: number): Promise<void> {
    const parent = await this.tasks.findById(parentId);
    if (!parent || parent.projectId !== projectId) {
      throw new ValidationError(null, 'Parent task must belong to the same project');
    }
    if (parent.parentId !== null) {
      throw new ValidationError(null, 'Subtasks cannot have their own subtasks');
    }
  }

  private async assertAssignable(projectId: number, assigneeId: number): Promise<void> {
    if (!(await this.access.hasRole(projectId, assigneeId, 'MEMBER'))) {
      throw new ValidationError(null, 'Assignee must be a member of the project');
    }
  }

  private async computePosition(task: Task, input: MoveTaskInput): Promise<number | null> {
    const ids = [input.beforeId, input.afterId].filter((id): id is number => id !== undefined);
    if (ids.includes(task.id)) throw new ValidationError(null, 'A task cannot be its own neighbour');

    const neighbours = await this.tasks.positions(ids);
    const byId = new Map<number, PositionInfo>(neighbours.map((n) => [n.id, n]));
    for (const id of ids) {
      const n = byId.get(id);
      if (!n || n.projectId !== task.projectId || n.parentId !== task.parentId || n.status !== input.status) {
        throw new ValidationError(null, 'Neighbour tasks must be in the target column');
      }
    }
    const before = input.beforeId !== undefined ? byId.get(input.beforeId)!.position : undefined;
    const after = input.afterId !== undefined ? byId.get(input.afterId)!.position : undefined;

    if (before === undefined && after === undefined) {
      const last = await this.tasks.lastPosition(task.projectId, task.parentId, input.status);
      return (last ?? 0) + POSITION_STEP;
    }
    return positionBetween(before, after);
  }
}
