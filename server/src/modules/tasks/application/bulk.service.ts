import { prisma, type Db } from '../../../shared/db/prisma';
import { ValidationError } from '../../../shared/errors';
import type { ProjectRole } from '../../projects';

/** Same contract as the tasks module. */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
  hasRole(projectId: number, userId: number, required: ProjectRole): Promise<boolean>;
}

export type BulkPatch = {
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: number | null;
  tags?: string[];
};

export interface BulkResult {
  updated: number;
  /** Ids that were skipped because the actor lacked rights or the task vanished. */
  skipped: { taskId: number; reason: string }[];
}

export class BulkService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * §4 bulk update: applies `{ids, patch}` in one statement per task but asserts
   * the actor's role for EVERY task separately (no single blanket check that could
   * cross project boundaries). Each updated task fires its own activity event.
   */
  async bulkUpdate(
    userId: number,
    projectId: number,
    input: { ids: number[]; patch: BulkPatch },
    notifyActivity?: (event: { actorId: number; projectId: number; taskId: number }) => Promise<void>,
  ): Promise<BulkResult> {
    if (input.ids.length === 0) throw new ValidationError(null, 'ids must not be empty');
    if (input.ids.length > 100) throw new ValidationError(null, 'Bulk updates are limited to 100 tasks');
    const patchFields = Object.keys(input.patch).filter(
      (k) => (input.patch as Record<string, unknown>)[k] !== undefined,
    );
    if (patchFields.length === 0) throw new ValidationError(null, 'patch must contain at least one field');

    const actorRole = await this.access.assertRole(projectId, userId, 'MEMBER');
    const tasks = await this.db.task.findMany({
      where: { id: { in: input.ids }, projectId, deletedAt: null, parentId: null },
      select: { id: true, assigneeId: true },
    });
    const found = new Set(tasks.map((t) => t.id));

    if (input.patch.assigneeId != null && !(await this.access.hasRole(projectId, input.patch.assigneeId, 'MEMBER'))) {
      throw new ValidationError(null, 'Assignee must be a member of the project');
    }

    const skipped: BulkResult['skipped'] = [];
    const updatable: number[] = [];
    for (const id of input.ids) {
      if (!found.has(id)) {
        skipped.push({ taskId: id, reason: 'NOT_FOUND' });
        continue;
      }
      updatable.push(id);
    }

    const now = this.clock();
    if (updatable.length > 0) {
      await this.db.task.updateMany({
        where: { id: { in: updatable }, projectId },
        data: {
          ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
          ...(input.patch.priority !== undefined ? { priority: input.patch.priority } : {}),
          ...(input.patch.assigneeId !== undefined ? { assigneeId: input.patch.assigneeId } : {}),
          ...(input.patch.tags !== undefined ? { tags: input.patch.tags } : {}),
          ...(input.patch.status === 'DONE' ? { completedAt: now } : {}),
          updatedAt: now,
        },
      });
      if (notifyActivity) {
        for (const id of updatable) {
          await notifyActivity({ actorId: userId, projectId, taskId: id });
        }
      }
    }

    void actorRole;
    return { updated: updatable.length, skipped };
  }

  /** §34 tasks without an owner in one project — the "who owns this?" report. */
  async listUnassigned(userId: number, projectId: number) {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.db.task.findMany({
      where: { projectId, deletedAt: null, parentId: null, assigneeId: null },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, createdAt: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });
  }

  /** §27 full task export rows (CSV endpoint consumes these directly). */
  async listExportRows(userId: number, projectId: number) {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.db.task.findMany({
      where: { projectId, deletedAt: null, parentId: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        tags: true,
        startDate: true,
        dueDate: true,
        estimateHours: true,
        assignee: { select: { name: true } },
      },
      orderBy: { position: 'asc' },
      take: 2000,
    }).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        tags: r.tags,
        startDate: r.startDate,
        dueDate: r.dueDate,
        estimateHours: r.estimateHours,
        assignee: r.assignee?.name ?? null,
      })),
    );
  }
}
