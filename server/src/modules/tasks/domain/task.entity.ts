import { ValidationError } from '../../../shared/errors';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const MAX_TAGS = 10;

export interface TaskProps {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  tags: string[];
  points: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  /** Effort estimate in working hours (scheduling input — see modules/scheduling). */
  estimateHours: number | null;
  authorId: number;
  assigneeId: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields a user may edit on a task. */
export interface TaskChanges {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  points?: number | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  estimateHours?: number | null;
  assigneeId?: number | null;
}

export interface NewTask extends TaskChanges {
  projectId: number;
  authorId: number;
  title: string;
  parentId?: number | null;
}

export type ValidNewTask = Required<Omit<NewTask, 'status' | 'priority'>> & {
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  completedAt: Date | null;
};

function normalizeTags(tags: string[]): string[] {
  const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (unique.length > MAX_TAGS) throw new ValidationError(null, `At most ${MAX_TAGS} tags`);
  return unique;
}

function assertDates(startDate: Date | null | undefined, dueDate: Date | null | undefined) {
  if (startDate && dueDate && startDate > dueDate) {
    throw new ValidationError(null, 'Start date cannot be after due date');
  }
}

export class Task {
  private constructor(private props: TaskProps) {}

  static validateNew(input: NewTask, position: number, now: Date): ValidNewTask {
    const title = input.title.trim();
    if (!title) throw new ValidationError(null, 'Task title is required');
    assertDates(input.startDate, input.dueDate);
    const status = input.status ?? 'TODO';
    return {
      projectId: input.projectId,
      authorId: input.authorId,
      parentId: input.parentId ?? null,
      title,
      description: input.description?.trim() || null,
      status,
      priority: input.priority ?? 'MEDIUM',
      position,
      tags: normalizeTags(input.tags ?? []),
      points: input.points ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      estimateHours: input.estimateHours ?? null,
      assigneeId: input.assigneeId ?? null,
      completedAt: status === 'DONE' ? now : null,
    };
  }

  static restore(props: TaskProps): Task {
    return new Task(props);
  }

  get id() {
    return this.props.id;
  }
  get projectId() {
    return this.props.projectId;
  }
  get parentId() {
    return this.props.parentId;
  }
  get status() {
    return this.props.status;
  }
  get authorId() {
    return this.props.authorId;
  }

  /** Applies edits and returns the persisted field changes (including derived completedAt). */
  applyChanges(changes: TaskChanges, now: Date): Partial<TaskProps> {
    const patch: Partial<TaskProps> = { ...changes };
    if (changes.title !== undefined) {
      patch.title = changes.title.trim();
      if (!patch.title) throw new ValidationError(null, 'Task title is required');
    }
    if (changes.description !== undefined) patch.description = changes.description?.trim() || null;
    if (changes.tags !== undefined) patch.tags = normalizeTags(changes.tags);
    if (changes.estimateHours != null && changes.estimateHours < 0) {
      throw new ValidationError(null, 'Estimate hours cannot be negative');
    }
    assertDates(
      changes.startDate !== undefined ? changes.startDate : this.props.startDate,
      changes.dueDate !== undefined ? changes.dueDate : this.props.dueDate,
    );
    if (changes.status !== undefined && changes.status !== this.props.status) {
      patch.completedAt = changes.status === 'DONE' ? now : null;
    }
    this.props = { ...this.props, ...patch };
    return patch;
  }

  isOverdue(now: Date): boolean {
    return !!this.props.dueDate && this.props.dueDate < now && this.props.status !== 'DONE';
  }

  toJSON(): TaskProps {
    return { ...this.props };
  }
}
