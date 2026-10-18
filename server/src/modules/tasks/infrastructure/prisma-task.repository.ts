import { Prisma, type Task as TaskRow } from '@prisma/client';
import type { Db } from '../../../shared/db/prisma';
import { POSITION_STEP } from '../domain/position';
import { Task, type TaskProps, type ValidNewTask } from '../domain/task.entity';
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
  // Stable order so the lead-then-co-assignees list does not shuffle between requests.
  collaborators: { select: { userId: true, user: userSummary }, orderBy: { id: 'asc' } },
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
  statusKey: row.statusKey,
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
  // Lead first, then the co-assignees — a lead who also has a co-assignee row is listed once.
  assignees: [
    ...(row.assignee ? [row.assignee] : []),
    ...row.collaborators.map((c) => c.user).filter((u) => u.id !== row.assignee?.id),
  ],
  subtaskCount: row.subtasks.length,
  doneSubtaskCount: row.subtasks.filter((s) => s.status === 'DONE').length,
  commentCount: row._count.comments,
});

/** Tasks that involve the user: they own the task or share it as a co-assignee. */
const involving = (userId: number): Prisma.TaskWhereInput => ({
  OR: [{ assigneeId: userId }, { collaborators: { some: { userId } } }],
});

/** Only live tasks of live projects. */
const alive = { deletedAt: null, project: { deletedAt: null } } satisfies Prisma.TaskWhereInput;

/** Siblings: same parent; top-level columns are additionally split by workflow column. */
const siblingsWhere = (projectId: number, parentId: number | null, statusKey: string) =>
  ({
    projectId,
    parentId,
    deletedAt: null,
    ...(parentId === null ? { statusKey } : {}),
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

  /** §11: finds soft-deleted rows too (restore flow checks deletedAt itself). */
  async findByIdAny(id: number): Promise<Task | null> {
    const row = await this.db.task.findFirst({ where: { id } });
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
        statusKey: filters.statusKey,
        priority: filters.priority,
        // Filtering by a person means "tasks they are on" — lead or co-assignee.
        ...(filters.assigneeId !== undefined ? involving(filters.assigneeId) : {}),
        ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      include: viewInclude,
      orderBy: [{ statusKey: 'asc' }, { position: 'asc' }, { id: 'asc' }],
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
        ...(filters.anyAssignee ? {} : involving(userId)),
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

  /** §11 recycling bin: only top-level rows; subtasks come along via subtaskCount views. */
  async listDeleted(projectId: number): Promise<TaskView[]> {
    const rows = await this.db.task.findMany({
      where: { projectId, deletedAt: { not: null }, parentId: null },
      include: viewInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toView);
  }

  /** Restores the task and any subtasks soft-deleted at/after the parent's own deletion. */
  async restore(id: number): Promise<TaskView | null> {
    const parent = await this.db.task.findFirst({
      where: { id, deletedAt: { not: null }, parentId: null },
      select: { deletedAt: true },
    });
    if (!parent) return null;
    // Same-timestamp match covers the delete action (one updateMany stamps both rows);
    // `gte` also catches subtasks deleted by later, separate delete calls.
    await this.db.task.updateMany({
      where: { OR: [{ id }, { parentId: id }], deletedAt: { gte: parent.deletedAt! } },
      data: { deletedAt: null, completedAt: null },
    });
    const restored = await this.db.task.findFirst({ where: { id }, include: viewInclude });
    return restored ? toView(restored) : null;
  }

  async lastPosition(
    projectId: number,
    parentId: number | null,
    statusKey: string,
  ): Promise<number | undefined> {
    const { _max } = await this.db.task.aggregate({
      where: siblingsWhere(projectId, parentId, statusKey),
      _max: { position: true },
    });
    return _max.position ?? undefined;
  }

  positions(ids: number[]): Promise<PositionInfo[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.task.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, projectId: true, parentId: true, statusKey: true, position: true },
    });
  }

  async assigneeSet(taskId: number): Promise<number[]> {
    const row = await this.db.task.findUnique({
      where: { id: taskId },
      select: {
        assigneeId: true,
        collaborators: { select: { userId: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!row) return [];
    return [
      ...(row.assigneeId === null ? [] : [row.assigneeId]),
      ...row.collaborators.map((c) => c.userId).filter((id) => id !== row.assigneeId),
    ];
  }

  /** One write for the whole set: the lead lives on the task, everyone else in the join table. */
  async setAssignees(taskId: number, userIds: number[]): Promise<TaskView> {
    const [leadId, ...collaboratorIds] = userIds;
    return toView(
      await this.db.task.update({
        where: { id: taskId },
        data: {
          assigneeId: leadId ?? null,
          collaborators: {
            deleteMany: {},
            create: collaboratorIds.map((userId) => ({ userId })),
          },
        },
        include: viewInclude,
      }),
    );
  }

  async rebalance(projectId: number, parentId: number | null, statusKey: string): Promise<void> {
    const statusFilter =
      parentId === null ? Prisma.sql`AND "statusKey" = ${statusKey}` : Prisma.empty;
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
    await this.db.$transaction(async (tx) => {
      // A member who left cannot stay a co-assignee anywhere in the project.
      await tx.taskCollaborator.deleteMany({ where: { userId, task: { projectId } } });
      // Where they were the lead, the task goes to the first remaining co-assignee (if any) —
      // a task never keeps a lead who is not on the project.
      const led = await tx.task.findMany({
        where: { projectId, assigneeId: userId },
        select: {
          id: true,
          collaborators: { select: { userId: true }, orderBy: { id: 'asc' }, take: 1 },
        },
      });
      for (const task of led) {
        await tx.task.update({
          where: { id: task.id },
          data: { assigneeId: task.collaborators[0]?.userId ?? null },
        });
      }
    });
  }
}
