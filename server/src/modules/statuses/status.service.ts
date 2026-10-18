import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { prisma, type Db } from '../../shared/db/prisma';
import type { ProjectRole } from '../projects';

/** What the statuses module needs from the projects module (same contract as tasks uses). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

/**
 * Analytics buckets a workflow column may belong to. Deliberately a local copy of the task
 * module's `TASK_STATUSES` instead of an import: tasks depends on this module (to resolve a
 * status key), so importing back would make the two modules a cycle.
 */
export const STATUS_CATEGORIES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export interface StatusView {
  id: number;
  key: string;
  label: string;
  color: string;
  category: StatusCategory;
  position: number;
}

/**
 * The four columns every project starts with. `key` is what tasks store, so these keys are
 * permanent — renaming a built-in changes its label, never its key.
 */
export const DEFAULT_STATUSES: readonly {
  key: string;
  label: string;
  color: string;
  category: StatusCategory;
  position: number;
}[] = [
  { key: 'TODO', label: 'To Do', color: '#64748b', category: 'TODO', position: 1024 },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', category: 'IN_PROGRESS', position: 2048 },
  { key: 'REVIEW', label: 'Review', color: '#a855f7', category: 'REVIEW', position: 3072 },
  { key: 'DONE', label: 'Done', color: '#22c55e', category: 'DONE', position: 4096 },
];

export interface StatusInput {
  label: string;
  color: string;
  category: StatusCategory;
  /** Insert directly after this key instead of at the end (the "QA between dev and release" case). */
  afterKey?: string;
}

export interface StatusPatch {
  label?: string;
  color?: string;
  category?: StatusCategory;
}

/** Gap between two columns — same fractional-indexing idea as task positions. */
const POSITION_STEP = 1024;

interface StatusRow {
  id: number;
  key: string;
  label: string;
  color: string;
  category: string;
  position: number;
}

const toView = (row: StatusRow): StatusView => ({
  id: row.id,
  key: row.key,
  label: row.label,
  color: row.color,
  category: row.category as StatusCategory,
  position: row.position,
});

const statusNotFound = () => new NotFoundError('STATUS_NOT_FOUND', 'Status not found');

/** "Developer Panel" → "DEVELOPER_PANEL"; non-latin labels fall back to a placeholder key. */
function slugifyKey(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  // Persian/Arabic labels keep their letters, which Postgres stores happily but which make a
  // poor status *key*; the caller uniquifies whatever we hand back.
  return slug.slice(0, 40) || 'STATUS';
}

export class StatusService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
  ) {}

  /** The project's workflow columns in board order (VIEWER+). */
  async list(userId: number, projectId: number): Promise<StatusView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    return this.ordered(projectId);
  }

  /** Board order, without an access check — internal callers (tasks) already checked. */
  async ordered(projectId: number): Promise<StatusView[]> {
    const rows = await this.db.projectStatus.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toView);
  }

  /** Resolves a status key of this project (null when the key is unknown to the project). */
  async resolve(projectId: number, key: string): Promise<StatusView | null> {
    const row = await this.db.projectStatus.findFirst({ where: { projectId, key } });
    return row ? toView(row) : null;
  }

  /**
   * The key a category-only caller (bulk "mark done", imports) should land on: the built-in key
   * when it still exists, otherwise the first column of that category, otherwise the first column.
   */
  async keyForCategory(projectId: number, category: StatusCategory): Promise<string> {
    const rows = await this.ordered(projectId);
    if (rows.length === 0) return category;
    return (
      rows.find((row) => row.key === category)?.key ??
      rows.find((row) => row.category === category)?.key ??
      rows[0]!.key
    );
  }

  /** Idempotent: gives a project the four built-in columns when it has none. */
  async ensureDefaults(projectId: number): Promise<void> {
    const count = await this.db.projectStatus.count({ where: { projectId } });
    if (count > 0) return;
    await this.db.projectStatus.createMany({
      data: DEFAULT_STATUSES.map((status) => ({ projectId, ...status })),
    });
  }

  async create(userId: number, projectId: number, input: StatusInput): Promise<StatusView> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    await this.ensureDefaults(projectId);
    const label = input.label.trim();
    if (!label) throw new ValidationError(null, 'Status label is required');

    const existing = await this.ordered(projectId);
    const key = await this.uniqueKey(projectId, slugifyKey(label));

    const after = input.afterKey ? existing.find((status) => status.key === input.afterKey) : undefined;
    if (input.afterKey && !after) {
      throw new ValidationError(null, 'afterKey must be a status of this project');
    }
    const next = after ? existing[existing.findIndex((s) => s.key === after.key) + 1] : undefined;
    const position = after
      ? next
        ? (after.position + next.position) / 2
        : after.position + POSITION_STEP
      : (existing.at(-1)?.position ?? 0) + POSITION_STEP;

    const row = await this.db.projectStatus.create({
      data: { projectId, key, label, color: input.color, category: input.category, position },
    });
    return toView(row);
  }

  /**
   * Renames/recolours/re-buckets a column. A category change is a semantics change, so the tasks
   * sitting in that column are re-bucketed in the same transaction (completedAt follows).
   */
  async update(
    userId: number,
    projectId: number,
    statusId: number,
    patch: StatusPatch,
  ): Promise<StatusView> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const current = await this.db.projectStatus.findFirst({ where: { id: statusId, projectId } });
    if (!current) throw statusNotFound();

    const label = patch.label?.trim();
    if (patch.label !== undefined && !label) throw new ValidationError(null, 'Status label is required');
    const recategorised = patch.category !== undefined && patch.category !== current.category;

    return this.db.$transaction(async (tx) => {
      if (recategorised) {
        await tx.task.updateMany({
          where: { projectId, statusKey: current.key },
          data: {
            status: patch.category,
            completedAt: patch.category === 'DONE' ? new Date() : null,
          },
        });
      }
      const row = await tx.projectStatus.update({
        where: { id: statusId },
        data: {
          ...(label !== undefined && { label }),
          ...(patch.color !== undefined && { color: patch.color }),
          ...(patch.category !== undefined && { category: patch.category }),
        },
      });
      return toView(row);
    });
  }

  /** Applies a new column order: positions are rewritten in the order the keys arrive. */
  async reorder(userId: number, projectId: number, keys: string[]): Promise<StatusView[]> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const current = await this.ordered(projectId);
    const known = new Set(current.map((status) => status.key));
    const unique = [...new Set(keys)];
    if (unique.length !== current.length || unique.some((key) => !known.has(key))) {
      throw new ValidationError(null, 'Reorder must list every status of the project exactly once');
    }

    await this.db.$transaction(
      unique.map((key, index) =>
        this.db.projectStatus.update({
          where: { projectId_key: { projectId, key } },
          data: { position: (index + 1) * POSITION_STEP },
        }),
      ),
    );
    return this.ordered(projectId);
  }

  /**
   * Deletes a column. The last remaining column is never deletable (that would leave tasks with
   * nowhere to go); a column that still holds tasks must name where they move to.
   */
  async remove(
    userId: number,
    projectId: number,
    statusId: number,
    moveToKey?: string,
  ): Promise<void> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const current = await this.db.projectStatus.findFirst({ where: { id: statusId, projectId } });
    if (!current) throw statusNotFound();

    const all = await this.ordered(projectId);
    if (all.length <= 1) {
      throw new ValidationError(null, 'A project needs at least one status');
    }
    if (moveToKey !== undefined && moveToKey === current.key) {
      throw new ValidationError(null, 'Tasks cannot move to the status being deleted');
    }

    const inUse = await this.db.task.count({ where: { projectId, statusKey: current.key } });
    const target = moveToKey
      ? all.find((status) => status.key === moveToKey)
      : undefined;
    if (moveToKey !== undefined && !target) {
      throw new ValidationError(null, 'moveToKey must be another status of this project');
    }
    if (inUse > 0 && !target) {
      throw new ConflictError(
        'STATUS_IN_USE',
        'This status still holds tasks — choose where they should move first',
      );
    }

    await this.db.$transaction(async (tx) => {
      if (target) {
        await tx.task.updateMany({
          where: { projectId, statusKey: current.key },
          data: {
            statusKey: target.key,
            status: target.category,
            completedAt: target.category === 'DONE' ? new Date() : null,
          },
        });
      }
      await tx.projectStatus.delete({ where: { id: statusId } });
    });
  }

  /** Adds "-2", "-3"… until the key is free inside the project. */
  private async uniqueKey(projectId: number, base: string): Promise<string> {
    const taken = new Set(
      (await this.db.projectStatus.findMany({ where: { projectId }, select: { key: true } })).map(
        (row) => row.key,
      ),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; i < 100; i += 1) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    throw new ConflictError('STATUS_EXISTS', 'Too many statuses with a similar name');
  }
}
