import type { Project as ProjectRow } from '@prisma/client';
import type { Db } from '../../../shared/db/prisma';
import { Project, type ProjectChanges, type ValidNewProject } from '../domain/project.entity';
import type { ProjectRole } from '../domain/project-role';
import type {
  MemberView,
  ProjectRepository,
  ProjectStats,
  ProjectView,
  TeammateView,
} from '../application/project.repository';

const toEntity = (row: ProjectRow): Project =>
  Project.restore({
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    ownerId: row.ownerId,
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

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly db: Db) {}

  async create(data: ValidNewProject): Promise<Project> {
    const row = await this.db.project.create({
      data: { ...data, members: { create: { userId: data.ownerId, role: 'OWNER' } } },
    });
    return toEntity(row);
  }

  async findById(id: number): Promise<Project | null> {
    const row = await this.db.project.findFirst({ where: { id, deletedAt: null } });
    return row ? toEntity(row) : null;
  }

  async update(id: number, patch: ProjectChanges): Promise<void> {
    await this.db.project.update({ where: { id }, data: patch });
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
      stats: stats.get(m.projectId) ?? { total: 0, done: 0, overdue: 0 },
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
    const [members, workload] = await Promise.all([
      this.db.projectMember.findMany({
        where: { projectId },
        include: { user: memberUser },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      }),
      this.db.task.groupBy({
        by: ['assigneeId'],
        where: openTaskWhere([projectId]),
        _count: { _all: true },
        _sum: { points: true },
      }),
    ]);
    const byUser = new Map(workload.map((w) => [w.assigneeId, w]));
    return members.map((m) => ({
      user: m.user,
      role: m.role,
      skills: m.skills,
      joinedAt: m.joinedAt,
      openTasks: byUser.get(m.userId)?._count._all ?? 0,
      openPoints: byUser.get(m.userId)?._sum.points ?? 0,
    }));
  }

  async addMember(projectId: number, userId: number, role: ProjectRole, skills: string[]): Promise<void> {
    await this.db.projectMember.create({ data: { projectId, userId, role, skills } });
  }

  async updateMember(
    projectId: number,
    userId: number,
    patch: { role?: ProjectRole; skills?: string[] },
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

    const [memberships, open, overdue] = await Promise.all([
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
        openTasks: openBy.get(m.userId)?._count._all ?? 0,
        openPoints: openBy.get(m.userId)?._sum.points ?? 0,
        overdueTasks: overdueBy.get(m.userId) ?? 0,
      });
    }
    return [...team.values()].sort((a, b) => b.openPoints - a.openPoints || a.user.name.localeCompare(b.user.name));
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
      if (!s) result.set(id, (s = { total: 0, done: 0, overdue: 0 }));
      return s;
    };
    for (const row of byStatus) {
      const s = get(row.projectId);
      s.total += row._count._all;
      if (row.status === 'DONE') s.done += row._count._all;
    }
    for (const row of overdue) get(row.projectId).overdue = row._count._all;
    return result;
  }
}
