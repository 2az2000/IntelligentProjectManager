import { prisma, type Db } from '../../../shared/db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { env } from '../../../config/env';
import type { ProjectRole } from '../../projects';
import { buildSchedule, type ScheduleResult, type ScheduleTask } from './schedule';
import { addWorkingHours, parseWeekend } from '../domain/work-calendar';

/** What scheduling needs from the projects module. */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

const taskNotFound = () => new NotFoundError('TASK_NOT_FOUND', 'Task not found');
const projectNotFound = () => new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

/**
 * Read model for building the schedule: only top-level, live tasks of live
 * projects, with just the scheduling-relevant fields.
 */
export async function loadScheduleInput(db: Db, projectId: number): Promise<{
  tasks: ScheduleTask[];
  deps: { predecessorId: number; successorId: number }[];
}> {
  const rows = await db.task.findMany({
    where: { projectId, deletedAt: null, parentId: null, project: { deletedAt: null } },
    select: {
      id: true,
      title: true,
      status: true,
      estimateHours: true,
      startDate: true,
      dueDate: true,
      blocks: { select: { predecessorId: true, successorId: true } },
    },
    orderBy: { id: 'asc' },
  });

  const deps = new Map<string, { predecessorId: number; successorId: number }>();
  for (const row of rows) {
    for (const d of row.blocks) deps.set(`${d.predecessorId}->${d.successorId}`, d);
  }
  return {
    tasks: rows.map(({ blocks: _blocks, ...t }) => ({
      ...t,
      startDate: t.startDate?.toISOString() ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
    })),
    deps: [...deps.values()],
  };
}

export class ScheduleService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
    private readonly clock: () => Date = () => new Date(),
    /** JS getDay() weekend values — Iranian Thu/Fri by default. */
    private readonly weekend: Set<number> = parseWeekend(env.WORKING_WEEKEND),
  ) {}

  async getSchedule(userId: number, projectId: number): Promise<ScheduleResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const { tasks, deps } = await loadScheduleInput(this.db, projectId);
    return buildSchedule(tasks, deps, this.weekend);
  }

  async getTaskSchedule(userId: number, taskId: number): Promise<ScheduleResult> {
    const task = await this.db.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
      select: { projectId: true },
    });
    if (!task) throw taskNotFound();
    return this.getSchedule(userId, task.projectId);
  }

  /**
   * Fills missing (or stale) dates from the CPM schedule; never touches manually set
   * future dates. Anchor for the offsets: the project's startDate (or now).
   */
  async applySchedule(userId: number, projectId: number): Promise<ScheduleResult> {
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const { tasks, deps } = await loadScheduleInput(this.db, projectId);
    const schedule = buildSchedule(tasks, deps, this.weekend);
    const now = this.clock();
    const project = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { startDate: true },
    });
    const anchor = project?.startDate && project.startDate > now ? project.startDate : now;

    for (const t of schedule.tasks) {
      const input = tasks.find((x) => x.id === t.id)!;
      const start = addWorkingHours(anchor, t.earliestStart ?? 0, this.weekend);
      const finish = addWorkingHours(start, t.estimateHours ?? 0, this.weekend);
      const needsUpdate = input.dueDate === null || new Date(input.dueDate) < now;
      if (!needsUpdate) continue;
      await this.db.task.update({
        where: { id: t.id },
        data: { startDate: start, dueDate: finish },
      });
    }
    return schedule;
  }
}

export interface DependencyView {
  predecessorId: number;
  successorId: number;
  type: 'FINISH_TO_START';
}

export class DependencyService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
  ) {}

  /** Loads both tasks, checks same-project membership and returns (project, role). */
  private async assertLinkable(
    userId: number,
    predecessorId: number,
    successorId: number,
  ): Promise<{ projectId: number; role: ProjectRole }> {
    if (predecessorId === successorId) {
      throw new ValidationError(null, 'A task cannot depend on itself');
    }
    const rows = await this.db.task.findMany({
      where: { id: { in: [predecessorId, successorId] }, deletedAt: null },
      select: { id: true, projectId: true, parentId: true },
    });
    if (rows.length !== 2) throw taskNotFound();

    const [predecessor, successor] =
      rows[0]!.id === predecessorId ? [rows[0]!, rows[1]!] : [rows[1]!, rows[0]!];
    if (predecessor.projectId !== successor.projectId) {
      throw new ValidationError(null, 'Dependencies must stay within one project');
    }
    if (predecessor.parentId !== null || successor.parentId !== null) {
      throw new ValidationError(null, 'Subtasks cannot take part in dependencies');
    }
    const role = await this.access.assertRole(predecessor.projectId, userId, 'MEMBER');
    return { projectId: predecessor.projectId, role };
  }

  async list(userId: number, projectId: number): Promise<DependencyView[]> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const project = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw projectNotFound();
    const rows = await this.db.taskDependency.findMany({
      where: {
        predecessor: { projectId, deletedAt: null },
        successor: { projectId, deletedAt: null },
      },
      select: { predecessorId: true, successorId: true, type: true },
      orderBy: [{ predecessorId: 'asc' }, { successorId: 'asc' }],
    });
    return rows.map((r) => ({ ...r, type: 'FINISH_TO_START' as const }));
  }

  async create(
    userId: number,
    predecessorId: number,
    successorId: number,
  ): Promise<DependencyView> {
    const { projectId } = await this.assertLinkable(userId, predecessorId, successorId);
    const edges = await this.db.taskDependency.findMany({
      where: {
        OR: [
          { predecessor: { projectId } },
          { successor: { projectId } },
        ],
      },
      select: { predecessorId: true, successorId: true },
    });

    if (edges.some((e) => e.predecessorId === predecessorId && e.successorId === successorId)) {
      throw new ConflictError('DEPENDENCY_EXISTS', 'This dependency already exists');
    }
    if (wouldCreateCycle(edges, predecessorId, successorId)) {
      throw new ConflictError('DEPENDENCY_CYCLE', 'Adding this dependency would create a cycle');
    }
    await this.db.taskDependency.create({
      data: { predecessorId, successorId, type: 'FINISH_TO_START' },
    });
    return { predecessorId, successorId, type: 'FINISH_TO_START' };
  }

  async remove(userId: number, predecessorId: number, successorId: number): Promise<void> {
    await this.assertLinkable(userId, predecessorId, successorId);
    const deleted = await this.db.taskDependency.deleteMany({
      where: { predecessorId, successorId },
    });
    if (deleted.count === 0) throw new NotFoundError('DEPENDENCY_NOT_FOUND', 'Dependency not found');
  }
}

/** Same DFS as scheduling/domain/dependency-resolver.wouldCreateCycle, over plain edge tuples. */
function wouldCreateCycle(
  edges: { predecessorId: number; successorId: number }[],
  from: number,
  to: number,
): boolean {
  const adjacency = new Map<number, number[]>();
  for (const e of edges) {
    const list = adjacency.get(e.predecessorId) ?? [];
    list.push(e.successorId);
    adjacency.set(e.predecessorId, list);
  }
  const stack = [to];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    const next = adjacency.get(node);
    if (next) stack.push(...next);
  }
  return false;
}
