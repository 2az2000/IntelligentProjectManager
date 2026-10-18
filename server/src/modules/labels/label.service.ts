import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { prisma, type Db } from '../../shared/db/prisma';
import type { ProjectRole } from '../projects';

/** What the labels module needs from the projects module (same contract as tasks uses). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

/** Icon keys the client can render; anything else would leave a label without a picture. */
export const LABEL_ICONS = [
  'flag',
  'bug',
  'shield',
  'server',
  'layout',
  'sparkles',
  'database',
  'zap',
  'bookmark',
  'palette',
  'users',
  'calendar',
] as const;

export type LabelIcon = (typeof LABEL_ICONS)[number];

export interface LabelInput {
  name: string;
  color: string;
  icon: LabelIcon;
}

export interface LabelView {
  id: number;
  name: string;
  color: string;
  icon: string;
}

interface LabelRow {
  id: number;
  name: string;
  color: string;
  icon: string;
}

const toView = (row: LabelRow): LabelView => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
});

const labelNotFound = () => new NotFoundError('LABEL_NOT_FOUND', 'Label not found');

export class LabelService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
  ) {}

  /** The project's label vocabulary (VIEWER+, alphabetical). */
  async list(userId: number, projectId: number): Promise<LabelView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const rows = await this.db.label.findMany({ where: { projectId }, orderBy: { name: 'asc' } });
    return rows.map(toView);
  }

  async create(userId: number, projectId: number, input: LabelInput): Promise<LabelView> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const name = input.name.trim();
    if (!name) throw new ValidationError(null, 'Label name is required');

    try {
      const row = await this.db.label.create({
        data: { projectId, name, color: input.color, icon: input.icon },
      });
      return toView(row);
    } catch (error: unknown) {
      // The unique index is the only real guard against two tabs racing to add "Backend".
      if (isUniqueViolation(error)) {
        throw new ConflictError('LABEL_EXISTS', 'This project already has a label with that name');
      }
      throw error;
    }
  }

  /**
   * Renames/recolours a label. Renaming rewrites the matching tag on every task of the project
   * (in the same transaction), so a vocabulary change never leaves tasks pointing at a name the
   * project no longer uses.
   */
  async update(
    userId: number,
    projectId: number,
    labelId: number,
    patch: Partial<LabelInput>,
  ): Promise<LabelView> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const current = await this.db.label.findFirst({ where: { id: labelId, projectId } });
    if (!current) throw labelNotFound();

    const name = patch.name?.trim();
    if (patch.name !== undefined && !name) throw new ValidationError(null, 'Label name is required');
    const renamed = name !== undefined && name !== current.name;

    if (renamed) {
      const clash = await this.db.label.findFirst({
        where: { projectId, name, id: { not: labelId } },
      });
      if (clash) throw new ConflictError('LABEL_EXISTS', 'This project already has a label with that name');
    }

    return this.db.$transaction(async (tx) => {
      if (renamed) {
        // array_replace keeps the tag in its original position; only the matching entry changes.
        await tx.$executeRaw`
          UPDATE "Task"
          SET "tags" = array_replace("tags", ${current.name}, ${name}),
              "updatedAt" = NOW()
          WHERE "projectId" = ${projectId} AND ${current.name} = ANY("tags")`;
      }
      const row = await tx.label.update({
        where: { id: labelId },
        data: {
          ...(name !== undefined && { name }),
          ...(patch.color !== undefined && { color: patch.color }),
          ...(patch.icon !== undefined && { icon: patch.icon }),
        },
      });
      return toView(row);
    });
  }

  /**
   * Removes a label from the vocabulary. Task tags are deliberately left alone: the tag stays on
   * the tasks that use it (now rendered as a plain tag), because deleting a label is not an
   * instruction to erase history from everyone's tasks.
   */
  async remove(userId: number, projectId: number, labelId: number): Promise<void> {
    await this.access.assertRole(projectId, userId, 'ADMIN');
    const deleted = await this.db.label.deleteMany({ where: { id: labelId, projectId } });
    if (deleted.count === 0) throw labelNotFound();
  }
}

/** Prisma's unique-constraint code, without importing the whole error type surface. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
