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

/**
 * §2.2 — the plan is computed, so the baseline freezes CPM offsets in working hours.
 * A→B chained: A 8h starts at 0, B 16h starts at 8, project duration 24h.
 */
async function chain() {
  const { owner, project, agent } = await setup();
  const a = await createTask({
    projectId: project.id,
    authorId: owner.id,
    title: 'A',
    estimateHours: 8,
  });
  const b = await createTask({
    projectId: project.id,
    authorId: owner.id,
    title: 'B',
    estimateHours: 16,
  });
  await prisma.taskDependency.create({
    data: { predecessorId: a.id, successorId: b.id, type: 'FINISH_TO_START' },
  });
  return { owner, project, agent, a, b };
}

describe('baseline capture', () => {
  it('snapshots the CPM offsets of every top-level task', async () => {
    const { project, agent, a, b } = await chain();

    const created = await agent.post(`/projects/${project.id}/baselines`).send({ name: 'Kickoff' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      projectId: project.id,
      name: 'Kickoff',
      taskCount: 2,
      projectDurationHours: 24,
    });
    expect(created.body.createdBy).toMatchObject({ id: expect.any(Number), name: expect.any(String) });

    const items = await prisma.scheduleBaselineItem.findMany({
      where: { baselineId: created.body.id },
      orderBy: { taskId: 'asc' },
    });
    expect(items.map((i) => [i.taskId, i.startHours, i.finishHours])).toEqual([
      [a.id, 0, 8],
      [b.id, 8, 24],
    ]);
  });

  it('names the snapshot when the body omits a name and lists newest first', async () => {
    const { project, agent } = await chain();

    const first = await agent.post(`/projects/${project.id}/baselines`).send({});
    const second = await agent.post(`/projects/${project.id}/baselines`).send({});
    expect(first.body.name).toBe('Baseline 1');
    expect(second.body.name).toBe('Baseline 2');

    const list = await agent.get(`/projects/${project.id}/baselines`);
    expect(list.status).toBe(200);
    expect(list.body.map((b: { id: number }) => b.id)).toEqual([second.body.id, first.body.id]);
  });

  it('needs MEMBER, so a viewer cannot snapshot the plan', async () => {
    const { project, owner } = await chain();
    const viewer = await createUser();
    await addMember(project.id, viewer.id, 'VIEWER');
    const viewerAgent = await loginAs(app, viewer.email);

    const res = await viewerAgent.post(`/projects/${project.id}/baselines`).send({});
    expect(res.status).toBe(403);
    // …but a viewer may still read the plan and its variance.
    const created = await prisma.scheduleBaseline.create({
      data: {
        projectId: project.id,
        name: 'Read only',
        createdById: owner.id,
        projectDurationHours: 0,
        taskCount: 0,
      },
    });
    expect((await viewerAgent.get(`/projects/${project.id}/baselines`)).status).toBe(200);
    expect((await viewerAgent.get(`/projects/${project.id}/baselines/${created.id}/variance`)).status).toBe(200);
  });

  it('rejects an over-long name', async () => {
    const { project, agent } = await chain();
    const res = await agent
      .post(`/projects/${project.id}/baselines`)
      .send({ name: 'x'.repeat(81) });
    expect(res.status).toBe(400);
  });
});

describe('baseline variance', () => {
  it('classifies moved, added, removed and untouched tasks', async () => {
    const { owner, project, agent, a, b } = await chain();
    const created = await agent.post(`/projects/${project.id}/baselines`).send({ name: 'Plan' });
    const baselineId = created.body.id as number;

    // Insert C between A and B: B slips by C's 8 hours, C itself is new.
    const c = await createTask({
      projectId: project.id,
      authorId: owner.id,
      title: 'C',
      estimateHours: 8,
    });
    await prisma.taskDependency.deleteMany({});
    await prisma.taskDependency.createMany({
      data: [
        { predecessorId: a.id, successorId: c.id, type: 'FINISH_TO_START' },
        { predecessorId: c.id, successorId: b.id, type: 'FINISH_TO_START' },
      ],
    });
    const res = await agent.get(`/projects/${project.id}/baselines/${baselineId}/variance`);
    expect(res.status).toBe(200);
    expect(res.body.baseline.id).toBe(baselineId);
    expect(res.body.currentDurationHours).toBe(32);
    expect(res.body.durationDriftHours).toBe(8);
    expect(res.body.counts).toEqual({ added: 1, removed: 0, moved: 1, onTrack: 1 });

    const byTitle = Object.fromEntries(
      res.body.tasks.map((t: { title: string }) => [t.title, t]),
    );
    expect(byTitle.C).toMatchObject({ action: 'added', currentStartHours: 8, baselineStartHours: null });
    expect(byTitle.A).toMatchObject({ action: 'onTrack', baselineStartHours: 0, driftHours: 0 });
    expect(byTitle.B).toMatchObject({
      action: 'moved',
      taskId: b.id,
      baselineStartHours: 8,
      currentStartHours: 16,
      driftHours: 8,
    });
    expect(res.body.totalDriftHours).toBe(8);
    // Biggest movement first.
    expect(res.body.tasks[0].title).toBe('B');
  });

  it('marks a task that left the plan as removed', async () => {
    const { project, agent, b } = await chain();
    const created = await agent.post(`/projects/${project.id}/baselines`).send({});

    // Soft delete keeps the row but drops it from the schedule input.
    await prisma.task.update({ where: { id: b.id }, data: { deletedAt: new Date() } });

    const res = await agent.get(`/projects/${project.id}/baselines/${created.body.id}/variance`);
    expect(res.body.counts).toEqual({ added: 0, removed: 1, moved: 0, onTrack: 1 });
    expect(res.body.tasks[0]).toMatchObject({
      action: 'removed',
      title: 'B',
      baselineStartHours: 8,
      currentStartHours: null,
    });
  });

  it('reports an unchanged plan as on-track', async () => {
    const { owner, project, agent } = await chain();
    const unestimated = await createTask({
      projectId: project.id,
      authorId: owner.id,
      title: 'No estimate',
    });
    expect(unestimated.id).toBeGreaterThan(0);

    const created = await agent.post(`/projects/${project.id}/baselines`).send({});
    const res = await agent.get(
      `/projects/${project.id}/baselines/${created.body.id}/variance`,
    );

    expect(res.body.counts).toEqual({ added: 0, removed: 0, moved: 0, onTrack: 3 });
    expect(res.body.durationDriftHours).toBe(0);
    expect(res.body.totalDriftHours).toBe(0);
    // Unestimated work has no position on the axis, so there is nothing to compare.
    const noEstimate = res.body.tasks.find((t: { title: string }) => t.title === 'No estimate');
    expect(noEstimate.driftHours).toBeNull();
  });

  it('404s for a baseline of another project', async () => {
    const { owner, project, agent } = await chain();
    const other = await createProject(owner.id);
    const created = await agent.post(`/projects/${project.id}/baselines`).send({});

    expect(
      (await agent.get(`/projects/${other.id}/baselines/${created.body.id}/variance`)).status,
    ).toBe(404);
  });
});
