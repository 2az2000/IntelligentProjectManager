import { Prisma, type Task as TaskRow } from '@prisma/client';
import type { Db } from '../../../shared/db/prisma';
import { POSITION_STEP } from '../domain/position';
import { Task, type TaskProps, type TaskStatus, type ValidNewTask } from '../domain/task.entity';
import type {
  AssignedTaskFilters,
  PositionInfo,
  TaskDetailView,
  TaskFilters,
  TaskPatch,
  TaskRepository,
  TaskView,
} from '../application/task.repository';

const userSummary = { select: { id: true, name: true, avatarUrl: true } } as const;

const viewInclude = {
  project: { select: { id: true, name: true } },
  author: userSummary,
  assignee: userSummary,
  subtasks: { where: { deletedAt: null }, select: { status: true } },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.TaskInclude;

type ViewRow = Prisma.TaskGetPayload<{ include: typeof viewInclude }>;

const toProps = (row: TaskRow): TaskProps => ({
  id: row.id,
  projectId: row.projectId,
  parentId: row.parentId,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  position: row.position,
  tags: row.tags,
  points: row.points,
  startDate: row.startDate,
  dueDate: row.dueDate,
  completedAt: row.completedAt,
  estimateHours: row.estimateHours,
  authorId: row.authorId,
  assigneeId: row.assigneeId,
  deletedAt: row.deletedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toView = (row: ViewRow): TaskView => ({
  ...toProps(row),
  project: row.project,
  author: row.author,
  assignee: row.assignee,
  subtaskCount: row.subtasks.length,
  doneSubtaskCount: row.subtasks.filter((s) => s.status === 'DONE').length,
  commentCount: row._count.comments,
});

/** Only live tasks of live projects. */
const alive = { deletedAt: null, project: { deletedAt: null } } satisfies Prisma.TaskWhereInput;

/** Siblings: same parent; top-level columns are additionally split by status. */
const siblingsWhere = (projectId: number, parentId: number | null, status: TaskStatus) =>
  ({
    projectId,
    parentId,
    deletedAt: null,
    ...(parentId === null ? { status } : {}),
  }) satisfies Prisma.TaskWhereInput;

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly db: Db) {}

  async create(data: ValidNewTask): Promise<TaskView> {
    return toView(await this.db.task.create({ data, include: viewInclude }));
  }

  async findById(id: number): Promise<Task | null> {
    const row = await this.db.task.findFirst({ where: { id, ...alive } });
    return row ? Task.restore(toProps(row)) : null;
  }

  async getDetail(id: number): Promise<TaskDetailView | null> {
    const row = await this.db.task.findFirst({ where: { id, ...alive }, include: viewInclude });
    if (!row) return null;
    const subtasks = await this.db.task.findMany({
      where: { parentId: id, deletedAt: null },
      include: viewInclude,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return { ...toView(row), subtasks: subtasks.map(toView) };
  }

  async list(projectId: number, filters: TaskFilters): Promise<TaskView[]> {
    const rows = await this.db.task.findMany({
      where: {
        projectId,
        ...alive,
        parentId: filters.parentId ?? null,
        status: filters.status,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      include: viewInclude,
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toView);
  }

  async listForUser(
    userId: number,
    projectIds: number[],
    filters: AssignedTaskFilters,
  ): Promise<TaskView[]> {
    const rows = await this.db.task.findMany({
      where: {
        ...alive,
        projectId: { in: projectIds },
        ...(filters.anyAssignee ? {} : { assigneeId: userId }),
        ...(filters.includeDone ? {} : { status: { not: 'DONE' } }),
        ...(filters.dueFrom || filters.dueTo
          ? { dueDate: { gte: filters.dueFrom, lte: filters.dueTo } }
          : {}),
      },
      include: viewInclude,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { id: 'asc' }],
      take: 500,
    });
    return rows.map(toView);
  }

  async update(id: number, patch: TaskPatch): Promise<TaskView> {
    return toView(await this.db.task.update({ where: { id }, data: patch, include: viewInclude }));
  }

  async softDelete(id: number, now: Date): Promise<void> {
    await this.db.task.updateMany({
      where: { OR: [{ id }, { parentId: id }], deletedAt: null },
      data: { deletedAt: now },
    });
  }

  async lastPosition(
    projectId: number,
    parentId: number | null,
    status: TaskStatus,
  ): Promise<number | undefined> {
    const { _max } = await this.db.task.aggregate({
      where: siblingsWhere(projectId, parentId, status),
      _max: { position: true },
    });
    return _max.position ?? undefined;
  }

  positions(ids: number[]): Promise<PositionInfo[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.task.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, projectId: true, parentId: true, status: true, position: true },
    });
  }

  async rebalance(projectId: number, parentId: number | null, status: TaskStatus): Promise<void> {
    const statusFilter =
      parentId === null ? Prisma.sql`AND "status" = ${status}::"TaskStatus"` : Prisma.empty;
    await this.db.$executeRaw`
      UPDATE "Task" t SET "position" = ranked.rn * ${POSITION_STEP}
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "position", "id") AS rn
        FROM "Task"
        WHERE "projectId" = ${projectId}
          AND "parentId" IS NOT DISTINCT FROM ${parentId}::int
          AND "deletedAt" IS NULL
          ${statusFilter}
      ) ranked
      WHERE t."id" = ranked."id"`;
  }

  async unassignUser(projectId: number, userId: number): Promise<void> {
    await this.db.task.updateMany({
      where: { projectId, assigneeId: userId },
      data: { assigneeId: null },
    });
  }
}
