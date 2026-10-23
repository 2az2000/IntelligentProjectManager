import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import type { ProjectRole } from '../domain/project-role';

/** What saved views need from the projects module (satisfied by ProjectService). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

/** §4 saved views — per-user, per-project named filter sets (board or list). */
export const SAVED_VIEW_LIMIT = 20;

export const SAVED_VIEW_GROUPS = ['none', 'assignee', 'priority', 'status'] as const;
export type SavedViewGroup = (typeof SAVED_VIEW_GROUPS)[number];

export interface SavedViewFilters {
  search?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  /** `0` means "unassigned" (same convention as the board filters). */
  assigneeId?: number;
  groupBy?: SavedViewGroup;
}

export interface SavedView {
  id: number;
  projectId: number;
  userId: number;
  name: string;
  filters: SavedViewFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedViewRepository {
  list(projectId: number, userId: number): Promise<SavedView[]>;
  find(id: number): Promise<SavedView | null>;
  count(projectId: number, userId: number): Promise<number>;
  create(userId: number, projectId: number, name: string, filters: SavedViewFilters): Promise<SavedView>;
  update(id: number, input: { name?: string; filters?: SavedViewFilters }): Promise<SavedView>;
  remove(id: number): Promise<void>;
}

const notFound = () => new NotFoundError('SAVED_VIEW_NOT_FOUND', 'Saved view not found');
const nameTaken = () => new ConflictError('SAVED_VIEW_NAME_TAKEN', 'A view with this name already exists');

export class SavedViewService {
  constructor(
    private readonly views: SavedViewRepository,
    private readonly access: ProjectAccess,
  ) {}

  async list(userId: number, projectId: number): Promise<SavedView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.views.list(projectId, userId);
  }

  async create(
    userId: number,
    projectId: number,
    input: { name: string; filters: SavedViewFilters },
  ): Promise<SavedView> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    if ((await this.views.count(projectId, userId)) >= SAVED_VIEW_LIMIT) {
      throw new ValidationError(null, `At most ${SAVED_VIEW_LIMIT} saved views per project`);
    }
    const name = input.name.trim();
    if (!name) throw new ValidationError(null, 'View name is required');
    try {
      return await this.views.create(userId, projectId, name, input.filters);
    } catch (error) {
      // A unique index races with the check above; the database is the source of truth.
      if ((error as { code?: unknown }).code === 'P2002') throw nameTaken();
      throw error;
    }
  }

  async update(
    userId: number,
    projectId: number,
    viewId: number,
    input: { name?: string; filters?: SavedViewFilters },
  ): Promise<SavedView> {
    await this.owned(userId, projectId, viewId);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) throw new ValidationError(null, 'View name is required');
    try {
      return await this.views.update(viewId, {
        ...(name !== undefined && { name }),
        ...(input.filters !== undefined && { filters: input.filters }),
      });
    } catch (error) {
      if ((error as { code?: unknown }).code === 'P2002') throw nameTaken();
      throw error;
    }
  }

  async remove(userId: number, projectId: number, viewId: number): Promise<void> {
    await this.owned(userId, projectId, viewId);
    await this.views.remove(viewId);
  }

  /** Views are personal: someone else's view answers 404, exactly like a missing one. */
  private async owned(userId: number, projectId: number, viewId: number): Promise<SavedView> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const view = await this.views.find(viewId);
    if (!view || view.projectId !== projectId || view.userId !== userId) throw notFound();
    return view;
  }
}
