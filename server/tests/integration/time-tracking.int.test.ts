import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/** A project with one task, ready to have time booked against it. */
async function scenario() {
  const owner = await createUser({ name: 'Owner Omid' });
  const project = await createProject(owner.id);
  const task = await createTask({ projectId: project.id, authorId: owner.id, title: 'Migrate the billing service' });
  const agent = await loginAs(app, owner.email);
  return { owner, project, task, agent };
}

describe('time entries', () => {
  it('start → stop books the minutes on the task and reaches the weekly summary', async () => {
    const { task, agent } = await scenario();

    const started = await agent.post(`/tasks/${task.id}/time/start`);
    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ taskId: task.id, endedAt: null, minutes: 0, manual: false });

    // The open stopwatch is what the task sheet renders as "running".
    const open = await agent.get('/me/timer');
    expect(open.status).toBe(200);
    expect(open.body).toMatchObject({ taskId: task.id, taskTitle: 'Migrate the billing service' });

    const stopped = await agent.post(`/tasks/${task.id}/time/stop`);
    expect(stopped.status).toBe(200);
    // A sub-minute stopwatch still bills one minute rather than zero.
    expect(stopped.body.minutes).toBe(1);
    expect(stopped.body.endedAt).not.toBeNull();

    // Nothing is left running once it is stopped.
    expect((await agent.get('/me/timer')).body).toBeNull();

    const summary = await agent.get('/me/time-summary');
    expect(summary.status).toBe(200);
    expect(summary.body.totalMinutes).toBe(1);
    expect(summary.body.perTask).toEqual([{ taskId: task.id, taskTitle: 'Migrate the billing service', minutes: 1 }]);
  });

  it('starting a second timer closes the first one (one open stopwatch per user)', async () => {
    const { project, owner, task, agent } = await scenario();
    const other = await createTask({ projectId: project.id, authorId: owner.id, title: 'Second task' });

    await agent.post(`/tasks/${task.id}/time/start`);
    await agent.post(`/tasks/${other.id}/time/start`);

    expect(await prisma.timeEntry.count({ where: { endedAt: null } })).toBe(1);
    expect((await agent.get('/me/timer')).body.taskId).toBe(other.id);
  });

  it('accepts a manual entry for forgotten time and lists it on the task', async () => {
    const { task, agent } = await scenario();

    const manual = await agent
      .post(`/tasks/${task.id}/time/manual`)
      .send({ startedAt: '2026-03-02T09:00:00.000Z', minutes: 90 });
    expect(manual.status).toBe(201);
    expect(manual.body).toMatchObject({ minutes: 90, manual: true });

    const list = await agent.get(`/tasks/${task.id}/time`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ taskId: task.id, minutes: 90, manual: true });
  });

  it('rejects a manual entry outside 1..1440 minutes', async () => {
    const { task, agent } = await scenario();

    const zero = await agent
      .post(`/tasks/${task.id}/time/manual`)
      .send({ startedAt: new Date().toISOString(), minutes: 0 });
    expect(zero.status).toBe(400);

    const tooLong = await agent
      .post(`/tasks/${task.id}/time/manual`)
      .send({ startedAt: new Date().toISOString(), minutes: 1441 });
    expect(tooLong.status).toBe(400);
  });
});

describe('cost report', () => {
  it('prices tracked hours at the member rate, falling back to the project rate', async () => {
    const { project, owner, task, agent } = await scenario();
    const contractor = await createUser({ name: 'Contractor Kimia' });
    await addMember(project.id, contractor.id, 'MEMBER');

    // The project carries a default rate; the contractor overrides it.
    const priced = await agent
      .patch(`/projects/${project.id}`)
      .send({ hourlyRate: 50 });
    expect(priced.status).toBe(200);
    const override = await agent
      .patch(`/projects/${project.id}/members/${contractor.id}`)
      .send({ hourlyRate: 80 });
    expect(override.status).toBe(200);

    await agent.post(`/tasks/${task.id}/time/manual`).send({ startedAt: new Date().toISOString(), minutes: 600 });
    const asContractor = await loginAs(app, contractor.email);
    await asContractor
      .post(`/tasks/${task.id}/time/manual`)
      .send({ startedAt: new Date().toISOString(), minutes: 300 });

    const res = await agent.get(`/projects/${project.id}/cost`);
    expect(res.status).toBe(200);
    expect(res.body.trackedMinutes).toBe(900);
    expect(res.body.unpricedMinutes).toBe(0);
    // 10h × 50 + 5h × 80
    expect(res.body.bookedCost).toBe(900);

    const ownerRow = res.body.perMember.find((m: { userId: number }) => m.userId === owner.id);
    const contractorRow = res.body.perMember.find((m: { userId: number }) => m.userId === contractor.id);
    expect(ownerRow).toMatchObject({ minutes: 600, hourlyRate: 50, cost: 500 });
    expect(contractorRow).toMatchObject({ minutes: 300, hourlyRate: 80, cost: 400 });
  });

  it('counts hours as unpriced when nobody has a rate, instead of inventing one', async () => {
    const { project, task, agent } = await scenario();
    await agent.post(`/tasks/${task.id}/time/manual`).send({ startedAt: new Date().toISOString(), minutes: 120 });

    const res = await agent.get(`/projects/${project.id}/cost`);
    expect(res.status).toBe(200);
    expect(res.body.bookedCost).toBe(0);
    expect(res.body.unpricedMinutes).toBe(120);
    expect(res.body.perMember[0].cost).toBeNull();
  });

  it('hides the report from non-members and lets a VIEWER read it', async () => {
    const { project, task, owner, agent } = await scenario();
    await agent.post(`/tasks/${task.id}/time/manual`).send({ startedAt: new Date().toISOString(), minutes: 60 });

    const stranger = await createUser();
    const hidden = await (await loginAs(app, stranger.email)).get(`/projects/${project.id}/cost`);
    expect(hidden.status).toBe(404);

    const viewer = await createUser();
    await addMember(project.id, viewer.id, 'VIEWER');
    const readable = await (await loginAs(app, viewer.email)).get(`/projects/${project.id}/cost`);
    expect(readable.status).toBe(200);

    // …but a VIEWER may not book time.
    const denied = await (await loginAs(app, viewer.email))
      .post(`/tasks/${task.id}/time/manual`)
      .send({ startedAt: new Date().toISOString(), minutes: 30 });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('INSUFFICIENT_ROLE');
    expect(owner.id).toBeGreaterThan(0);
  });

  it('does not leak another project\u2019s time into the report', async () => {
    const { project, owner, task, agent } = await scenario();
    const otherProject = await createProject(owner.id, { name: 'Unrelated' });
    const otherTask = await createTask({ projectId: otherProject.id, authorId: owner.id, title: 'Elsewhere' });

    await agent.post(`/tasks/${task.id}/time/manual`).send({ startedAt: new Date().toISOString(), minutes: 60 });
    await agent.post(`/tasks/${otherTask.id}/time/manual`).send({ startedAt: new Date().toISOString(), minutes: 480 });

    const res = await agent.get(`/projects/${project.id}/cost`);
    expect(res.body.trackedMinutes).toBe(60);
  });
});
