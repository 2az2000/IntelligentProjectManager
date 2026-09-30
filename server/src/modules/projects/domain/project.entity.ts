import { ValidationError } from '../../../shared/errors';

export interface ProjectProps {
  id: number;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProject {
  name: string;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export type ProjectChanges = Partial<NewProject>;

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
