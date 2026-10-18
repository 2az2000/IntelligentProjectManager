import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/** Owner + project + two more members, all able to be assigned work. */
async function setup() {
  const owner = await createUser();
  const project = await createProject(owner.id);
  const agent = await loginAs(app, owner.email);
  const sara = await createUser({ name: 'Sara' });
  const reza = await createUser({ name: 'Reza' });
  await addMember(project.id, sara.id, 'MEMBER');
  await addMember(project.id, reza.id, 'MEMBER');
  return { owner, project, agent, sara, reza };
}

const ids = (assignees: { id: number }[]) => assignees.map((a) => a.id);

describe('multiple assignees: lead + co-assignees', () => {
  it('creates a task with a lead and co-assignees, lead first', async () => {
    const { project, agent, sara, reza } = await setup();

    const res = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Pair on the payment flow', assigneeIds: [sara.id, reza.id] });

    expect(res.status).toBe(201);
    expect(res.body.assignee).toMatchObject({ id: sara.id });
    expect(ids(res.body.assignees)).toEqual([sara.id, reza.id]);
    // The lead stays on the task row; everyone else lives in the join table.
    expect(await prisma.taskCollaborator.count({ where: { taskId: res.body.id } })).toBe(1);
  });

  it('replaces the whole set on an explicit edit', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Swap owners', assigneeIds: [sara.id, reza.id] });

    const patched = await agent.patch(`/tasks/${task.body.id}`).send({ assigneeIds: [reza.id] });

    expect(patched.status).toBe(200);
    expect(ids(patched.body.assignees)).toEqual([reza.id]);
    expect(patched.body.assignee).toMatchObject({ id: reza.id });
    expect(await prisma.taskCollaborator.count({ where: { taskId: task.body.id } })).toBe(0);
  });

  it('changes only the lead when the legacy field is used, keeping the co-assignees', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Lead handover', assigneeIds: [sara.id, reza.id] });

    const patched = await agent.patch(`/tasks/${task.body.id}`).send({ assigneeId: reza.id });

    // Reza leads now and is no longer listed twice; sara stays on the task.
    expect(ids(patched.body.assignees)).toEqual([reza.id, sara.id]);
  });

  it('leaves the task unowned when the assignee is cleared', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Nobody owns it', assigneeIds: [sara.id, reza.id] });

    const cleared = await agent.patch(`/tasks/${task.body.id}`).send({ assigneeId: null });

    expect(cleared.body.assignee).toBeNull();
    expect(cleared.body.assignees).toEqual([]);
    expect(await prisma.taskCollaborator.count({ where: { taskId: task.body.id } })).toBe(0);
  });

  it('rejects an assignee who is not a project member', async () => {
    const { project, agent, sara } = await setup();
    const outsider = await createUser();
    const task = await createTask({ projectId: project.id, authorId: project.ownerId, assigneeId: sara.id });

    const viaSet = await agent
      .patch(`/tasks/${task.id}`)
      .send({ assigneeIds: [sara.id, outsider.id] });
    expect(viaSet.status).toBe(400);

    const viaCreate = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Bad set', assigneeIds: [outsider.id] });
    expect(viaCreate.status).toBe(400);
  });

  it('filters the board by any assignee, not just the lead', async () => {
    const { project, agent, sara, reza } = await setup();
    await createTask({ projectId: project.id, authorId: project.ownerId, title: 'Lead only', assigneeId: project.ownerId });
    const shared = await createTask({ projectId: project.id, authorId: project.ownerId, title: 'Shared', assigneeId: sara.id });
    await prisma.taskCollaborator.create({ data: { taskId: shared.id, userId: reza.id } });

    const byReza = await agent.get(`/projects/${project.id}/tasks?assigneeId=${reza.id}`);
    expect(byReza.body.map((t: { title: string }) => t.title)).toEqual(['Shared']);

    const bySara = await agent.get(`/projects/${project.id}/tasks?assigneeId=${sara.id}`);
    expect(bySara.body.map((t: { title: string }) => t.title)).toEqual(['Shared']);
  });

  it('shows a shared task in the co-assignee’s own list', async () => {
    const { project, sara, reza } = await setup();
    await createTask({ projectId: project.id, authorId: project.ownerId, title: 'Shared', assigneeId: sara.id });
    const shared = await prisma.task.findFirst({ where: { title: 'Shared' } });
    await prisma.taskCollaborator.create({ data: { taskId: shared!.id, userId: reza.id } });

    const rezaAgent = await loginAs(app, reza.email);
    const mine = await rezaAgent.get('/me/tasks');
    expect(mine.body.map((t: { title: string }) => t.title)).toEqual(['Shared']);
    // …and it counts as the co-assignee's open work on the dashboard too.
    const dashboard = await rezaAgent.get('/dashboard/summary');
    expect(dashboard.body.myOpenTasks).toBe(1);
  });

  it('notifies every new assignee, never the actor', async () => {
    const { owner, project, agent, sara, reza } = await setup();

    await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Notify all', assigneeIds: [sara.id, reza.id] });

    expect((await (await loginAs(app, sara.email)).get('/notifications/unread-count')).body.count).toBe(1);
    expect((await (await loginAs(app, reza.email)).get('/notifications/unread-count')).body.count).toBe(1);

    // Adding the actor himself to the set produces no notification for him.
    const task = await prisma.task.findFirst({ where: { title: 'Notify all' } });
    await agent.patch(`/tasks/${task!.id}`).send({ assigneeIds: [sara.id, reza.id, owner.id] });
    expect((await agent.get('/notifications/unread-count')).body.count).toBe(0);
  });

  it('notifies all assignees about a comment', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Discuss', assigneeIds: [sara.id, reza.id] });

    await agent.post(`/tasks/${task.body.id}/comments`).send({ body: 'status?' });

    // One ASSIGNED on create + one COMMENTED: both assignees are on the task.
    const saraAgent = await loginAs(app, sara.email);
    const rezaAgent = await loginAs(app, reza.email);
    const saraList = await saraAgent.get('/notifications');
    const rezaList = await rezaAgent.get('/notifications');
    expect(saraList.body.map((n: { type: string }) => n.type).sort()).toEqual(['ASSIGNED', 'COMMENTED']);
    expect(rezaList.body.map((n: { type: string }) => n.type).sort()).toEqual(['ASSIGNED', 'COMMENTED']);
  });

  it('logs the ownership change as a single activity row', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Audited', assigneeIds: [sara.id] });
    await agent.patch(`/tasks/${task.body.id}`).send({ assigneeIds: [reza.id, sara.id] });

    const activity = await agent.get(`/tasks/${task.body.id}/activity`);
    const rows = activity.body.filter((r: { field: string | null }) => r.field === 'assignees');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      oldValue: String(sara.id),
      newValue: `${reza.id}, ${sara.id}`,
    });
  });

  it('hands a departing lead’s task to the next co-assignee', async () => {
    const { project, agent, sara, reza } = await setup();
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Handover', assigneeIds: [sara.id, reza.id] });

    const removed = await agent.delete(`/projects/${project.id}/members/${sara.id}`);
    expect(removed.status).toBe(204);

    const after = await agent.get(`/tasks/${task.body.id}`);
    expect(after.body.assignee).toMatchObject({ id: reza.id });
    expect(ids(after.body.assignees)).toEqual([reza.id]);
    expect(await prisma.taskCollaborator.count({ where: { userId: sara.id } })).toBe(0);
  });

  it('reports a task as unassigned only when nobody is on it', async () => {
    const { project, agent, sara } = await setup();
    await createTask({ projectId: project.id, authorId: project.ownerId, title: 'Covered', assigneeId: sara.id });
    await createTask({ projectId: project.id, authorId: project.ownerId, title: 'Orphan' });

    const unassigned = await agent.get(`/projects/${project.id}/tasks/unassigned`);
    expect(unassigned.body.map((t: { title: string }) => t.title)).toEqual(['Orphan']);
  });
});
