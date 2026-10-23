import { Prisma, type Project as ProjectRow } from '@prisma/client';
import type { Db } from '../../../shared/db/prisma';
import { DEFAULT_STATUSES } from '../../statuses';
import { Project, type ProjectChanges, type ValidNewProject } from '../domain/project.entity';
import type { ProjectRole } from '../domain/project-role';
import {
  MemberView,
  ProjectRepository,
  ProjectStats,
  ProjectView,
  TeamWorkloadView,
  TeammateView,
} from '../application/project.repository';
import { aggregateWorkload, type WeekWindow, type WorkloadTask } from '../application/workload';

const toEntity = (row: ProjectRow): Project =>
  Project.restore({
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    ownerId: row.ownerId,
    columnLimits: (row.columnLimits as Record<string, number> | null) ?? null,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

const userSummary = { select: { id: true, name: true, avatarUrl: true } } as const;
const memberUser = { select: { id: true, name: true, avatarUrl: true, email: true } } as const;

/** Workload counts only live, unfinished top-level work in live projects. */
const openTaskWhere = (projectIds: number[]) => ({
  projectId: { in: projectIds },
  deletedAt: null,
  status: { not: 'DONE' as const },
});

interface Load {
  tasks: number;
  points: number;
  estimateHours: number;
}

/**
 * Per-user share of the tasks matched by `where` where the user is a **co-assignee** (the lead is
 * already counted by the `groupBy assigneeId` queries). Without this a member who only shares
 * work through co-assignee rows would look idle in the members panel and the team heatmap.
 */
const coAssigneeLoad = async (db: Db, where: Prisma.TaskWhereInput): Promise<Map<number, Load>> => {
  const rows = await db.taskCollaborator.findMany({
    where: { task: where },
    select: { userId: true, task: { select: { points: true, estimateHours: true } } },
  });
  const byUser = new Map<number, Load>();
  for (const row of rows) {
    const load = byUser.get(row.userId) ?? { tasks: 0, points: 0, estimateHours: 0 };
    load.tasks += 1;
    load.points += row.task.points ?? 0;
    load.estimateHours += row.task.estimateHours ?? 0;
    byUser.set(row.userId, load);
  }
  return byUser;
};

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly db: Db) {}

  async create(data: ValidNewProject): Promise<Project> {
    // Every project is born with the four built-in workflow columns (nested write, same tx).
    const row = await this.db.project.create({
      data: {
        ...data,
        // Nullable JSON needs Prisma's explicit SQL-NULL marker, not a JS null.
        columnLimits: data.columnLimits ?? Prisma.DbNull,
        members: { create: { userId: data.ownerId, role: 'OWNER' } },
        statuses: { create: DEFAULT_STATUSES.map((status) => ({ ...status })) },
      },
    });
    return toEntity(row);
  }

  async findById(id: number): Promise<Project | null> {
    const row = await this.db.project.findFirst({ where: { id, deletedAt: null } });
    return row ? toEntity(row) : null;
  }

  async update(id: number, patch: ProjectChanges): Promise<void> {
    const { columnLimits, ...rest } = patch;
    await this.db.project.update({
      where: { id },
      data: {
        ...rest,
        ...(columnLimits !== undefined && { columnLimits: columnLimits ?? Prisma.DbNull }),
      },
    });
  }

  async softDelete(id: number, now: Date): Promise<void> {
    await this.db.project.update({ where: { id }, data: { deletedAt: now } });
  }

  async listViewsForUser(userId: number, now: Date, projectId?: number): Promise<ProjectView[]> {
    const memberships = await this.db.projectMember.findMany({
      where: { userId, project: { deletedAt: null, ...(projectId ? { id: projectId } : {}) } },
      include: {
        project: { include: { owner: userSummary, _count: { select: { members: true } } } },
      },
      orderBy: { project: { createdAt: 'desc' } },
    });
    const stats = await this.stats(memberships.map((m) => m.projectId), now);

    return memberships.map((m) => ({
      project: toEntity(m.project),
      role: m.role,
      owner: m.project.owner,
      memberCount: m.project._count.members,
      stats: stats.get(m.projectId) ?? { total: 0, done: 0, overdue: 0, subtaskProgress: [] },
    }));
  }

  async findRole(projectId: number, userId: number): Promise<ProjectRole | null> {
    const member = await this.db.projectMember.findFirst({
      where: { projectId, userId, project: { deletedAt: null } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  async projectIdsForUser(userId: number): Promise<number[]> {
    const rows = await this.db.projectMember.findMany({
      where: { userId, project: { deletedAt: null } },
      select: { projectId: true },
    });
    return rows.map((r) => r.projectId);
  }

  async listMembers(projectId: number): Promise<MemberView[]> {
    const [members, workload, shared] = await Promise.all([
      this.db.projectMember.findMany({
        where: { projectId },
        include: { user: memberUser },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      }),
      this.db.task.groupBy({
        by: ['assigneeId'],
        where: openTaskWhere([projectId]),
        _count: { _all: true },
        _sum: { points: true, estimateHours: true },
      }),
      coAssigneeLoad(this.db, openTaskWhere([projectId])),
    ]);
    const byUser = new Map(workload.map((w) => [w.assigneeId, w]));
    return members.map((m) => ({
      user: m.user,
      role: m.role,
      skills: m.skills,
      joinedAt: m.joinedAt,
      capacityHoursPerWeek: m.capacityHoursPerWeek,
      openEstimateHours:
        (byUser.get(m.userId)?._sum.estimateHours ?? 0) + (shared.get(m.userId)?.estimateHours ?? 0),
      openTasks: (byUser.get(m.userId)?._count._all ?? 0) + (shared.get(m.userId)?.tasks ?? 0),
      openPoints: (byUser.get(m.userId)?._sum.points ?? 0) + (shared.get(m.userId)?.points ?? 0),
    }));
  }

  async addMember(projectId: number, userId: number, role: ProjectRole, skills: string[]): Promise<void> {
    await this.db.projectMember.create({ data: { projectId, userId, role, skills } });
  }

  async updateMember(
    projectId: number,
    userId: number,
    patch: { role?: ProjectRole; skills?: string[]; capacityHoursPerWeek?: number | null; hourlyRate?: number | null },
  ): Promise<void> {
    await this.db.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: patch,
    });
  }

  async removeMember(projectId: number, userId: number): Promise<void> {
    await this.db.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  }

  async teamForUser(userId: number, now: Date): Promise<TeammateView[]> {
    const projectIds = await this.projectIdsForUser(userId);
    if (projectIds.length === 0) return [];

    const [memberships, open, overdue, sharedOpen, sharedOverdue] = await Promise.all([
      this.db.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        include: { user: memberUser },
      }),
      this.db.task.groupBy({
        by: ['assigneeId'],
        where: openTaskWhere(projectIds),
        _count: { _all: true },
        _sum: { points: true },
      }),
      this.db.task.groupBy({
        by: ['assigneeId'],
        where: { ...openTaskWhere(projectIds), dueDate: { lt: now } },
        _count: { _all: true },
      }),
      coAssigneeLoad(this.db, openTaskWhere(projectIds)),
      coAssigneeLoad(this.db, { ...openTaskWhere(projectIds), dueDate: { lt: now } }),
    ]);

    const openBy = new Map(open.map((w) => [w.assigneeId, w]));
    const overdueBy = new Map(overdue.map((w) => [w.assigneeId, w._count._all]));
    const team = new Map<number, TeammateView>();
    for (const m of memberships) {
      const entry = team.get(m.userId);
      if (entry) {
        entry.projectCount++;
        continue;
      }
      team.set(m.userId, {
        user: m.user,
        projectCount: 1,
        // Lead work plus the work they only share as a co-assignee.
        openTasks: (openBy.get(m.userId)?._count._all ?? 0) + (sharedOpen.get(m.userId)?.tasks ?? 0),
        openPoints: (openBy.get(m.userId)?._sum.points ?? 0) + (sharedOpen.get(m.userId)?.points ?? 0),
        overdueTasks: (overdueBy.get(m.userId) ?? 0) + (sharedOverdue.get(m.userId)?.tasks ?? 0),
      });
    }
    return [...team.values()].sort((a, b) => b.openPoints - a.openPoints || a.user.name.localeCompare(b.user.name));
  }

  async teamWorkloadForUser(userId: number, weeks: WeekWindow[], now: Date): Promise<TeamWorkloadView[]> {
    const projectIds = await this.projectIdsForUser(userId);
    const memberships = await this.db.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      include: { user: memberUser },
    });
    // A member in several projects appears once; the first row's capacity stays authoritative.
    const unique = new Map(memberships.map((m) => [m.userId, m]));
    const members = [...unique.values()];
    if (members.length === 0 || projectIds.length === 0) return [];

    // Top-level tasks only: a parent's estimate already covers its subtasks, so counting
    // both would double-book the same hours in the heat cells.
    const rows = await this.db.task.findMany({
      where: { ...openTaskWhere(projectIds), parentId: null },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { name: true } },
        startDate: true,
        dueDate: true,
        estimateHours: true,
        createdAt: true,
        assigneeId: true,
        collaborators: { select: { userId: true } },
      },
    });
    const tasks: WorkloadTask[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      projectId: r.projectId,
      projectName: r.project.name,
      assigneeId: r.assigneeId,
      collaboratorIds: r.collaborators.map((c) => c.userId),
      startDate: r.startDate,
      dueDate: r.dueDate,
      estimateHours: r.estimateHours,
      createdAt: r.createdAt,
    }));

    const workload = aggregateWorkload(
      tasks,
      members.map((m) => ({ id: m.userId })),
      weeks,
      now,
    );
    return members
      .map((m) => ({
        user: m.user,
        hours: [...workload.get(m.userId)!.hours],
        cells: workload.get(m.userId)!.tasks.map((list) => list.map((entry) => ({ ...entry }))),
        capacityHoursPerWeek: m.capacityHoursPerWeek,
      }))
      .sort(
        (a, b) =>
          b.hours.reduce((s, h) => s + h, 0) - a.hours.reduce((s, h) => s + h, 0) ||
          a.user.name.localeCompare(b.user.name),
      );
  }

  private async stats(projectIds: number[], now: Date): Promise<Map<number, ProjectStats>> {
    if (projectIds.length === 0) return new Map();
    const topLevel = { projectId: { in: projectIds }, deletedAt: null, parentId: null };
    const [byStatus, overdue] = await Promise.all([
      this.db.task.groupBy({ by: ['projectId', 'status'], where: topLevel, _count: { _all: true } }),
      this.db.task.groupBy({
        by: ['projectId'],
        where: { ...topLevel, status: { not: 'DONE' }, dueDate: { lt: now } },
        _count: { _all: true },
      }),
    ]);
    const result = new Map<number, ProjectStats>();
    const get = (id: number) => {
      let s = result.get(id);
      if (!s) result.set(id, (s = { total: 0, done: 0, overdue: 0, subtaskProgress: [] }));
      return s;
    };
    for (const row of byStatus) {
      const s = get(row.projectId);
      s.total += row._count._all;
      if (row.status === 'DONE') s.done += row._count._all;
    }
    for (const row of overdue) get(row.projectId).overdue = row._count._all;

    // §3 subtask-derived progress for parent cards (done/total per parent).
    const subtaskGroups = await this.db.task.groupBy({
      by: ['parentId', 'status'],
      where: { projectId: { in: projectIds }, deletedAt: null, parentId: { not: null } },
      _count: { _all: true },
    });
    const progress = new Map<number, { done: number; total: number }>();
    for (const row of subtaskGroups) {
      if (row.parentId === null) continue;
      const entry = progress.get(row.parentId) ?? { done: 0, total: 0 };
      entry.total += row._count._all;
      if (row.status === 'DONE') entry.done += row._count._all;
      progress.set(row.parentId, entry);
    }
    for (const s of result.values()) {
      s.subtaskProgress = [...progress.entries()].map(([taskId, p]) => ({ taskId, ...p }));
    }
    return result;
  }
}
