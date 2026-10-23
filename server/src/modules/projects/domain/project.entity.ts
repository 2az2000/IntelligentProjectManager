import { ValidationError } from '../../../shared/errors';

/** §4 WIP limits: workflow-column key → max open cards. Missing key = unlimited. */
export type ColumnLimits = Record<string, number>;

export interface ProjectProps {
  id: number;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: number;
  columnLimits: ColumnLimits | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProject {
  name: string;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  /** §6: default billing rate (members without their own override get charged this). */
  hourlyRate?: number | null;
  /** §6: approved budget — progress bar in the cost report. */
  budgetAmount?: number | null;
  /** §4 WIP limits per column (null clears them all). */
  columnLimits?: ColumnLimits | null;
}

export type ProjectChanges = Partial<NewProject>;

/** Drops blank keys and non-positive limits so an empty map means "no limits". */
export function normalizeColumnLimits(input: ColumnLimits | null | undefined): ColumnLimits | null {
  if (!input) return null;
  const entries = Object.entries(input)
    .filter(([key, value]) => key.trim() !== '' && Number.isFinite(value) && value > 0)
    .map(([key, value]) => [key.trim(), Math.floor(value)] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export type ValidNewProject = Required<NewProject> & { ownerId: number };

function assertDates(startDate: Date | null | undefined, endDate: Date | null | undefined) {
  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError(null, 'Start date cannot be after end date');
  }
}

export class Project {
  private constructor(private props: ProjectProps) {}

  /** Validates invariants for a project that has not been persisted yet. */
  static validateNew(input: NewProject, ownerId: number): ValidNewProject {
    const name = input.name.trim();
    if (!name) throw new ValidationError(null, 'Project name is required');
    assertDates(input.startDate, input.endDate);
    return {
      name,
      description: input.description?.trim() || null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      hourlyRate: input.hourlyRate ?? null,
      budgetAmount: input.budgetAmount ?? null,
      columnLimits: normalizeColumnLimits(input.columnLimits),
      ownerId,
    };
  }

  static restore(props: ProjectProps): Project {
    return new Project(props);
  }

  get id() {
    return this.props.id;
  }
  get ownerId() {
    return this.props.ownerId;
  }

  applyChanges(changes: ProjectChanges): ProjectChanges {
    const patch: ProjectChanges = { ...changes };
    if (changes.name !== undefined) {
      patch.name = changes.name.trim();
      if (!patch.name) throw new ValidationError(null, 'Project name is required');
    }
    if (changes.description !== undefined) patch.description = changes.description?.trim() || null;
    if (changes.hourlyRate !== undefined && changes.hourlyRate !== null && changes.hourlyRate < 0) {
      throw new ValidationError(null, 'hourlyRate cannot be negative');
    }
    if (changes.budgetAmount !== undefined && changes.budgetAmount !== null && changes.budgetAmount < 0) {
      throw new ValidationError(null, 'budgetAmount cannot be negative');
    }
    if (changes.columnLimits !== undefined) {
      patch.columnLimits = normalizeColumnLimits(changes.columnLimits);
    }
    assertDates(
      changes.startDate !== undefined ? changes.startDate : this.props.startDate,
      changes.endDate !== undefined ? changes.endDate : this.props.endDate,
    );
    this.props = { ...this.props, ...patch } as ProjectProps;
    return patch;
  }

  isActive(now: Date): boolean {
    const { startDate, endDate } = this.props;
    return (!startDate || startDate <= now) && (!endDate || endDate >= now);
  }

  toJSON(): ProjectProps {
    return { ...this.props };
  }
}
