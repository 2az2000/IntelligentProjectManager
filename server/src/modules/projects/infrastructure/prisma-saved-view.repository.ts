import type { Prisma, SavedView as SavedViewRow } from '@prisma/client';
import type { Db } from '../../../shared/db/prisma';
import type {
  SavedView,
  SavedViewFilters,
  SavedViewRepository,
} from '../application/saved-view.service';

const toView = (row: SavedViewRow): SavedView => ({
  id: row.id,
  projectId: row.projectId,
  userId: row.userId,
  name: row.name,
  filters: (row.filters as SavedViewFilters | null) ?? {},
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PrismaSavedViewRepository implements SavedViewRepository {
  constructor(private readonly db: Db) {}

  async list(projectId: number, userId: number): Promise<SavedView[]> {
    const rows = await this.db.savedView.findMany({
      where: { projectId, userId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map(toView);
  }

  async find(id: number): Promise<SavedView | null> {
    const row = await this.db.savedView.findUnique({ where: { id } });
    return row ? toView(row) : null;
  }

  count(projectId: number, userId: number): Promise<number> {
    return this.db.savedView.count({ where: { projectId, userId } });
  }

  async create(
    userId: number,
    projectId: number,
    name: string,
    filters: SavedViewFilters,
  ): Promise<SavedView> {
    const row = await this.db.savedView.create({
      data: { userId, projectId, name, filters: filters as Prisma.InputJsonValue },
    });
    return toView(row);
  }

  async update(
    id: number,
    input: { name?: string; filters?: SavedViewFilters },
  ): Promise<SavedView> {
    const row = await this.db.savedView.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.filters !== undefined && {
          filters: input.filters as Prisma.InputJsonValue,
        }),
      },
    });
    return toView(row);
  }

  async remove(id: number): Promise<void> {
    await this.db.savedView.delete({ where: { id } });
  }
}
