import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import type { TaskFieldChange } from '../../../shared/realtime/bus';
import { hasRole, type ProjectRole } from '../../projects';
import type { StatusCategory, StatusView } from '../../statuses';
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

export type CreateTaskInput = Omit<NewTask, 'authorId'> & {
  /** Full assignee set: the first id becomes the lead. Wins over `assigneeId` when both are sent. */
  assigneeIds?: number[];
};

/** A task edit: the editable fields plus the whole assignee set as an explicit replacement. */
export type UpdateTaskInput = TaskChanges & { assigneeIds?: number[] };

export interface MoveTaskInput {
  /** Target workflow column (`ProjectStatus.key`). */
  statusKey: string;
  /** Task that will sit directly above the moved task (same column). */
  beforeId?: number;
  /** Task that will sit directly below the moved task (same column). */
  afterId?: number;
}

/**
 * What tasks need from the statuses module. Structural (not the class) so unit tests can pass a
 * stub and the tasks module keeps depending on a contract instead of an implementation.
 */
export interface StatusLookup {
  ordered(projectId: number): Promise<StatusView[]>;
  resolve(projectId: number, key: string): Promise<StatusView | null>;
  keyForCategory(projectId: number, category: StatusCategory): Promise<string>;
  ensureDefaults(projectId: number): Promise<void>;
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

/**
 * Fields tracked in the activity log / realtime payload.
 *
 * `description` and `tags` are here so the task's activity report can say *what* changed on an
 * edit instead of a bare "updated the task" — the report is only as useful as this list.
 * Ownership is tracked as `assignees` (the whole set) rather than the bare `assigneeId` column.
 */
const TRACKED_FIELDS = [
  'title',
  'status',
  'statusKey',
  'priority',
  'startDate',
  'dueDate',
  'points',
  'estimateHours',
  'description',
  'tags',
] as const;

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
    private readonly statuses: StatusLookup,
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

    const { assigneeIds, assigneeId, ...fields } = input;
    const assignees = await this.assertAssignees(
      input.projectId,
      assigneeIds ?? (assigneeId != null ? [assigneeId] : []),
    );

    const column = await this.resolveColumn(input.projectId, input.statusKey, input.status);
    const last = await this.tasks.lastPosition(input.projectId, parentId, column.key);
    const position = (last ?? 0) + POSITION_STEP;
    let created = await this.tasks.create(
      Task.validateNew(
        {
          ...fields,
          assigneeId: assignees[0],
          statusKey: column.key,
          status: column.category,
          authorId: userId,
        },
        position,
        this.clock(),
      ),
    );
    // Everyone beyond the lead is stored in the join table — one extra write, same request.
    if (assignees.length > 1) created = await this.tasks.setAssignees(created.id, assignees);
    await this.fire({
      actorId: userId,
      projectId: input.projectId,
      taskId: created.id,
      kind: 'created',
      ...(assignees.length > 0 && { notifyUserIds: assignees }),
    });
    return created;
  }

  async update(userId: number, taskId: number, input: UpdateTaskInput): Promise<TaskView> {
    const task = await this.load(taskId);
    await this.access.assertRole(task.projectId, userId, 'MEMBER');

    const { assigneeIds, ...fields } = input;
    const ownershipEdited = assigneeIds !== undefined || fields.assigneeId !== undefined;
    const previousAssignees = ownershipEdited ? await this.tasks.assigneeSet(taskId) : [];
    const nextAssignees = !ownershipEdited
      ? undefined
      : assigneeIds !== undefined
        ? // An explicit set replaces everything; the first id leads.
          await this.assertAssignees(task.projectId, assigneeIds)
        : fields.assigneeId == null
          ? // Legacy `assigneeId: null` means "nobody owns this" — the co-assignees go too.
            []
          : // Legacy single edit: only the lead changes, co-assignees stay (nobody listed twice).
            await this.assertAssignees(task.projectId, [
              fields.assigneeId,
              ...previousAssignees.filter((id) => id !== fields.assigneeId),
            ]);

    // The set is a relation, not a column — it is written through setAssignees below.
    const changes: TaskChanges = { ...fields };
    delete changes.assigneeId;

    const snapshot = task.toJSON();
    // A column edit always lands as a (key, category) pair: a key carries its own bucket, and a
    // legacy category-only edit resolves to that category's own column so the two never drift.
    const resolved: TaskChanges =
      changes.statusKey !== undefined || changes.status !== undefined
        ? {
            ...changes,
            ...(await this.columnPatch(task.projectId, changes.statusKey, changes.status)),
          }
        : changes;
    const diff = [
      ...this.diffAssignees(previousAssignees, nextAssignees),
      ...this.diffChanges(snapshot, resolved),
    ];
    const patch = task.applyChanges(resolved, this.clock());
    // Changing column through an edit moves the card to the end of the new column.
    // Compare against the snapshot — applyChanges mutates the entity in place.
    if (resolved.statusKey !== undefined && resolved.statusKey !== snapshot.statusKey) {
      const last = await this.tasks.lastPosition(task.projectId, task.parentId, resolved.statusKey);
      patch.position = (last ?? 0) + POSITION_STEP;
    }
    let updated = await this.tasks.update(taskId, patch);
    if (nextAssignees !== undefined) updated = await this.tasks.setAssignees(taskId, nextAssignees);

    // Only people who were not on the task before hear about it (the actor is never notified).
    const added = nextAssignees?.filter((id) => !previousAssignees.includes(id)) ?? [];
    await this.fire({
      actorId: userId,
      projectId: updated.projectId,
      taskId: updated.id,
      kind: 'updated',
      changes: diff,
      ...(added.length > 0 && { notifyUserIds: added }),
    });
    return updated;
  }

  /** Moves a task to a column and between two neighbours (drag & drop). */
  async move(userId: number, taskId: number, input: MoveTaskInput): Promise<TaskView> {
    const task = await this.load(taskId);
    await this.access.assertRole(task.projectId, userId, 'MEMBER');

    const column = await this.resolveColumn(task.projectId, input.statusKey);
    let position = await this.computePosition(task, { ...input, statusKey: column.key });
    if (position === null) {
      await this.tasks.rebalance(task.projectId, task.parentId, column.key);
      position =
        (await this.computePosition(task, { ...input, statusKey: column.key })) ?? POSITION_STEP;
    }
    const previous = task.toJSON(); // applyChanges mutates the entity in place
    const patch = task.applyChanges(
      { statusKey: column.key, status: column.category },
      this.clock(),
    );
    const moved = await this.tasks.update(taskId, {
      ...patch,
      statusKey: column.key,
      status: column.category,
      position,
    });
    await this.fire({
      actorId: userId,
      projectId: moved.projectId,
      taskId: moved.id,
      kind: 'moved',
      changes: [
        { field: 'statusKey', oldValue: previous.statusKey, newValue: column.key },
        { field: 'status', oldValue: previous.status, newValue: column.category },
      ],
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

  /**
   * Ownership diff: one activity row describing the whole assignee set, old → new.
   * Values are comma-joined user ids; the client resolves them to names.
   */
  private diffAssignees(before: number[], after?: number[]): TaskFieldChange[] {
    if (!after) return [];
    const same = before.length === after.length && before.every((id, i) => id === after[i]);
    if (same) return [];
    const value = (ids: number[]) => (ids.length === 0 ? null : ids.join(', '));
    return [{ field: 'assignees', oldValue: value(before), newValue: value(after) }];
  }

  /**
   * Validates an assignee set: unknown ids and non-members are rejected, duplicates collapse.
   * Order is preserved because the first id becomes the lead.
   */
  private async assertAssignees(projectId: number, userIds: number[]): Promise<number[]> {
    const unique = [...new Set(userIds)];
    for (const id of unique) await this.assertAssignable(projectId, id);
    return unique;
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
      if (
        !n ||
        n.projectId !== task.projectId ||
        n.parentId !== task.parentId ||
        n.statusKey !== input.statusKey
      ) {
        throw new ValidationError(null, 'Neighbour tasks must be in the target column');
      }
    }
    const before = input.beforeId !== undefined ? byId.get(input.beforeId)!.position : undefined;
    const after = input.afterId !== undefined ? byId.get(input.afterId)!.position : undefined;

    if (before === undefined && after === undefined) {
      const last = await this.tasks.lastPosition(task.projectId, task.parentId, input.statusKey);
      return (last ?? 0) + POSITION_STEP;
    }
    return positionBetween(before, after);
  }

  /**
   * Maps whatever the caller sent onto a real column of the project.
   *
   * A key wins over a category; a category (the legacy `status` field, bulk edits) resolves to
   * that category's own column. Unknown keys are a validation error, never a silent default —
   * a typo must not quietly drop a card into the first column.
   */
  /** `{ statusKey, status }` for the API — the pair every write is normalised to. */
  private async columnPatch(
    projectId: number,
    key?: string,
    category?: TaskStatus,
  ): Promise<{ statusKey: string; status: TaskStatus }> {
    const column = await this.resolveColumn(projectId, key, category);
    return { statusKey: column.key, status: column.category };
  }

  private async resolveColumn(
    projectId: number,
    key?: string,
    category?: TaskStatus,
  ): Promise<{ key: string; category: TaskStatus }> {
    if (key !== undefined) {
      const column = await this.ensureColumns(projectId, key);
      if (!column) throw new ValidationError(null, `Unknown status "${key}" for this project`);
      return { key: column.key, category: column.category };
    }
    if (category !== undefined) {
      const resolved = await this.statuses.keyForCategory(projectId, category);
      return { key: resolved, category };
    }
    await this.statuses.ensureDefaults(projectId);
    const [first] = await this.statuses.ordered(projectId);
    return first
      ? { key: first.key, category: first.category }
      : { key: 'TODO', category: 'TODO' };
  }

  /**
   * Resolves a key, seeding the built-in columns once when a project somehow has none (rows
   * written before this feature, or a project created outside the repository).
   */
  private async ensureColumns(projectId: number, key: string): Promise<StatusView | null> {
    const found = await this.statuses.resolve(projectId, key);
    if (found) return found;
    await this.statuses.ensureDefaults(projectId);
    return this.statuses.resolve(projectId, key);
  }
}
