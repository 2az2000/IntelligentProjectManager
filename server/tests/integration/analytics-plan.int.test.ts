import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

/**
 * §3 deadline planner (`GET /projects/:id/plan`) — the inverse of the forecast: a target date goes
 * in, latest starts come out. Monte Carlo still supplies the required effort, so the numbers are
 * compared by invariants rather than exact hours.
 */
const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const owner = await createUser();
  const project = await createProject(owner.id, { name: 'Planner project' });
  const first = await createTask({ projectId: project.id, authorId: owner.id, title: 'First', estimateHours: 8 });
  const second = await createTask({ projectId: project.id, authorId: owner.id, title: 'Second', estimateHours: 16 });
  await prisma.taskDependency.create({ data: { predecessorId: first.id, successorId: second.id } });
  const agent = await loginAs(app, owner.email);
  return { owner, project, agent, first, second };
}

describe('deadline planner', () => {
  it('computes a feasible plan with latest starts ordered by slack', async () => {
    const { project, agent, first, second } = await setup();
    const by = new Date(Date.now() + 60 * DAY).toISOString();

    const res = await agent.get(`/projects/${project.id}/plan`).query({ by, confidence: 85 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      confidence: 85,
      feasible: true,
      projectDurationHours: 24,
      unestimatedTaskIds: [],
    });
    expect(res.body.requiredHours).toBeGreaterThanOrEqual(24);
    expect(res.body.bufferHours).toBeCloseTo(res.body.availableHours - res.body.requiredHours, 5);
    expect(res.body.bufferWorkingDays).toBe(Math.round((res.body.bufferHours / 8) * 10) / 10);

    expect(res.body.tasks.map((t: { taskId: number }) => t.taskId)).toEqual([first.id, second.id]);
    const [a, b] = res.body.tasks as {
      taskId: number;
      latestStart: string;
      latestFinish: string;
      slackHours: number;
      isCritical: boolean;
      mustStartNow: boolean;
    }[];
    expect(a!.isCritical).toBe(true);
    expect(b!.isCritical).toBe(true);
    // The chain shifts together: the successor starts after the predecessor's effort.
    expect(b!.slackHours).toBeCloseTo(a!.slackHours + 8, 5);
    expect(new Date(b!.latestStart).getTime()).toBeGreaterThan(new Date(a!.latestStart).getTime());
    expect(new Date(a!.latestFinish).getTime()).toBeGreaterThan(new Date(a!.latestStart).getTime());
    expect(res.body.mustStartNow).toEqual([]);
  });

  it('flags every task as already-late when the deadline cannot fit the effort', async () => {
    const { project, agent } = await setup();
    const by = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await agent.get(`/projects/${project.id}/plan`).query({ by, confidence: 95 });
    expect(res.status).toBe(200);
    expect(res.body.feasible).toBe(false);
    expect(res.body.bufferHours).toBeLessThan(0);
    expect(res.body.mustStartNow).toHaveLength(2);
    const now = Date.now();
    for (const task of res.body.tasks) {
      // An unattainable plan clamps latest start to the anchor instead of returning dates in the past.
      expect(new Date(task.latestStart).getTime()).toBeLessThanOrEqual(now + 1000);
      expect(task.mustStartNow).toBe(true);
    }
  });

  it('falls back to the project endDate, and rejects a missing or invalid deadline', async () => {
    const { project, agent } = await setup();

    const missing = await agent.get(`/projects/${project.id}/plan`);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.message).toContain('deadline');

    const invalidConfidence = await agent
      .get(`/projects/${project.id}/plan`)
      .query({ by: new Date(Date.now() + 10 * DAY).toISOString(), confidence: 70 });
    expect(invalidConfidence.status).toBe(400);

    const past = await agent
      .get(`/projects/${project.id}/plan`)
      .query({ by: new Date(Date.now() - DAY).toISOString(), confidence: 50 });
    expect(past.status).toBe(400);

    const endDate = new Date(Date.now() + 30 * DAY);
    await prisma.project.update({ where: { id: project.id }, data: { endDate } });
    const fromProject = await agent.get(`/projects/${project.id}/plan`).query({ confidence: 50 });
    expect(fromProject.status).toBe(200);
    expect(new Date(fromProject.body.deadline).toISOString()).toBe(endDate.toISOString());
  });

  it('is VIEWER-readable and hidden from non-members', async () => {
    const { owner, project } = await setup();
    const viewer = await createUser();
    const stranger = await createUser();
    await addMember(project.id, viewer.id, 'VIEWER');
    const by = new Date(Date.now() + 20 * DAY).toISOString();

    const asViewer = await loginAs(app, viewer.email);
    expect((await asViewer.get(`/projects/${project.id}/plan`).query({ by })).status).toBe(200);

    const asStranger = await loginAs(app, stranger.email);
    const hidden = await asStranger.get(`/projects/${project.id}/plan`).query({ by });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('PROJECT_NOT_FOUND');

    await addMember(project.id, stranger.id, 'MEMBER');
    // The owner still sees the plan once the stranger is a member too.
    expect((await (await loginAs(app, owner.email)).get(`/projects/${project.id}/plan`).query({ by })).status).toBe(200);
  });
});
