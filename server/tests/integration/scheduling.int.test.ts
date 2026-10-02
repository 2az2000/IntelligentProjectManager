import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await createUser();
  const project = await createProject(owner.id);
  const agent = await loginAs(app, owner.email);
  return { owner, project, agent };
}

async function taskIdByTitle(projectId: number, title: string): Promise<number> {
  const list = await prisma.task.findFirst({ where: { projectId, title }, select: { id: true } });
  if (!list) throw new Error(`task not found: ${title}`);
  return list.id;
}

describe('dependency endpoints', () => {
  it('creates, lists and deletes a dependency inside one project', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, title: 'A' });
    const b = await createTask({ projectId: project.id, authorId: owner.id, title: 'B' });

    const created = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: a.id, successorId: b.id });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      predecessorId: a.id,
      successorId: b.id,
      type: 'FINISH_TO_START',
    });

    const list = await agent.get(`/projects/${project.id}/dependencies`);
    expect(list.body).toHaveLength(1);

    const deleted = await agent.delete(`/projects/${project.id}/dependencies/${a.id}/${b.id}`);
    expect(deleted.status).toBe(204);
    expect((await agent.get(`/projects/${project.id}/dependencies`)).body).toHaveLength(0);
  });

  it('rejects cross-project links and duplicates', async () => {
    const { owner, project, agent } = await setup();
    const other = await createProject(owner.id);
    const a = await createTask({ projectId: project.id, authorId: owner.id });
    const b = await createTask({ projectId: project.id, authorId: owner.id });
    const outside = await createTask({ projectId: other.id, authorId: owner.id });

    const cross = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: a.id, successorId: outside.id });
    expect(cross.status).toBe(400);
    expect(cross.body.error.code).toBe('VALIDATION_ERROR');

    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: a.id, successorId: b.id });
    const dup = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: a.id, successorId: b.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DEPENDENCY_EXISTS');
  });

  it('blocks self, subtask and unknown-task links', async () => {
    const { owner, project, agent } = await setup();
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    const subtask = await createTask({ projectId: project.id, authorId: owner.id, parentId: task.id });

    const self = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: task.id, successorId: task.id });
    expect(self.status).toBe(400);

    const withSubtask = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: task.id, successorId: subtask.id });
    expect(withSubtask.status).toBe(400);

    const unknown = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: task.id, successorId: 99999 });
    expect(unknown.status).toBe(404);
  });

  it('rejects cycles with DEPENDENCY_CYCLE and cascades deletes with the task', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, title: 'A' });
    const b = await createTask({ projectId: project.id, authorId: owner.id, title: 'B' });
    const c = await createTask({ projectId: project.id, authorId: owner.id, title: 'C' });

    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: a.id, successorId: b.id });
    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: b.id, successorId: c.id });

    // a -> c closes the triangle (c is a transitive predecessor of a? no — a→b→c means a→c is fine)
    const ac = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: a.id, successorId: c.id });
    expect(ac.status).toBe(201);

    // c -> a closes the cycle a→b→c→a
    const cycle = await agent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: c.id, successorId: a.id });
    expect(cycle.status).toBe(409);
    expect(cycle.body.error.code).toBe('DEPENDENCY_CYCLE');

    await prisma.task.delete({ where: { id: b.id } });
    // b's edges (a→b, b→c) cascade away; the direct a→c edge survives.
    const deps = await agent.get(`/projects/${project.id}/dependencies`);
    expect(deps.body).toEqual([{ predecessorId: a.id, successorId: c.id, type: 'FINISH_TO_START' }]);
  });

  it('requires MEMBER role to create and VIEWER is read-only', async () => {
    const { owner, project, agent } = await setup();
    const viewer = await createUser();
    await addMember(project.id, viewer.id, 'VIEWER');
    const a = await createTask({ projectId: project.id, authorId: owner.id });
    const b = await createTask({ projectId: project.id, authorId: owner.id });
    const viewerAgent = await loginAs(app, viewer.email);

    const read = await viewerAgent.get(`/projects/${project.id}/dependencies`);
    expect(read.status).toBe(200);

    const write = await viewerAgent
      .post(`/projects/${project.id}/dependencies`)
      .send({ predecessorId: a.id, successorId: b.id });
    expect(write.status).toBe(403);
    expect((await agent.get(`/projects/${project.id}/dependencies`)).body).toHaveLength(0);
  });

  it('returns 404 for a project the user is not a member of', async () => {
    const { owner, project } = await setup();
    const outsider = await createUser();
    await createTask({ projectId: project.id, authorId: owner.id });
    const agent = await loginAs(app, outsider.email);

    expect((await agent.get(`/projects/${project.id}/dependencies`)).status).toBe(404);
    expect((await agent.get(`/projects/${project.id}/schedule`)).status).toBe(404);
  });
});

describe('schedule endpoints', () => {
  it('computes the critical path from estimates and dependencies', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, title: 'A', estimateHours: 8 });
    const b = await createTask({ projectId: project.id, authorId: owner.id, title: 'B', estimateHours: 16 });
    const c = await createTask({ projectId: project.id, authorId: owner.id, title: 'C', estimateHours: 8 });

    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: a.id, successorId: b.id });
    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: a.id, successorId: c.id });

    const schedule = await agent.get(`/projects/${project.id}/schedule`);
    expect(schedule.status).toBe(200);
    expect(schedule.body.projectDurationHours).toBe(24);
    expect(schedule.body.criticalPath).toEqual([a.id, b.id]);
    const byId = new Map<number, Record<string, unknown>>(schedule.body.tasks.map((t: { id: number }) => [t.id, t]));
    expect(byId.get(a.id)).toMatchObject({ earliestStart: 0, slack: 0, isCritical: true });
    expect(byId.get(b.id)).toMatchObject({ earliestStart: 8, slack: 0, isCritical: true });
    expect(byId.get(c.id)).toMatchObject({ earliestStart: 8, slack: 8, isCritical: false });
  });

  it('flags unestimated tasks and drops finished tasks from the critical path', async () => {
    const { owner, project, agent } = await setup();
    const done = await createTask({
      projectId: project.id,
      authorId: owner.id,
      title: 'done',
      status: 'DONE',
      estimateHours: 8,
    });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'no-estimate' });

    const schedule = await agent.get(`/projects/${project.id}/schedule`);
    expect(schedule.body.unestimatedTaskIds).toEqual([await taskIdByTitle(project.id, 'no-estimate')]);
    expect(schedule.body.projectDurationHours).toBe(0);
    expect(schedule.body.criticalPath).toHaveLength(0);
    const doneRow = schedule.body.tasks.find((t: { id: number }) => t.id === done.id);
    expect(doneRow.isCritical).toBe(false);
  });

  it('exposes the project schedule per task and returns 404 for deleted tasks', async () => {
    const { owner, project, agent } = await setup();
    const task = await createTask({ projectId: project.id, authorId: owner.id, estimateHours: 4 });

    const perTask = await agent.get(`/tasks/${task.id}/schedule`);
    expect(perTask.status).toBe(200);
    expect(perTask.body.tasks).toHaveLength(1);

    await agent.delete(`/tasks/${task.id}`);
    expect((await agent.get(`/tasks/${task.id}/schedule`)).status).toBe(404);
  });

  it('fills missing or stale dates on apply but keeps manual future dates', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, title: 'A', estimateHours: 8 });
    const b = await createTask({ projectId: project.id, authorId: owner.id, title: 'B', estimateHours: 8 });
    const future = new Date('2099-01-01T00:00:00.000Z');
    await prisma.task.update({
      where: { id: b.id },
      data: { startDate: future, dueDate: future },
    });

    await agent.post(`/projects/${project.id}/dependencies`).send({ predecessorId: a.id, successorId: b.id });
    const applied = await agent.post(`/projects/${project.id}/schedule/apply`);
    expect(applied.status).toBe(200);

    const aAfter = await prisma.task.findUniqueOrThrow({ where: { id: a.id } });
    expect(aAfter.startDate).not.toBeNull();
    expect(aAfter.dueDate).not.toBeNull();

    const bAfter = await prisma.task.findUniqueOrThrow({ where: { id: b.id } });
    // manual future dates are untouched
    expect(bAfter.startDate!.toISOString()).toBe(future.toISOString());
  });
});
