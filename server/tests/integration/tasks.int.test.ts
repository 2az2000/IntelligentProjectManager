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

const titles = (body: { title: string; status: string }[], status: string) =>
  body.filter((t) => t.status === status).map((t) => t.title);

describe('task ordering (move)', () => {
  it('appends new tasks to the end of their column', async () => {
    const { project, agent } = await setup();
    for (const title of ['A', 'B', 'C']) {
      await agent.post(`/projects/${project.id}/tasks`).send({ title });
    }
    const list = await agent.get(`/projects/${project.id}/tasks`);
    expect(titles(list.body, 'TODO')).toEqual(['A', 'B', 'C']);
  });

  it('moves a task between neighbours and across columns', async () => {
    const { project, agent } = await setup();
    const ids: Record<string, number> = {};
    for (const title of ['A', 'B', 'C']) {
      ids[title] = (await agent.post(`/projects/${project.id}/tasks`).send({ title })).body.id;
    }

    // C between A and B
    const moved = await agent
      .post(`/tasks/${ids.C}/move`)
      .send({ status: 'TODO', beforeId: ids.A, afterId: ids.B });
    expect(moved.status).toBe(200);
    let list = await agent.get(`/projects/${project.id}/tasks`);
    expect(titles(list.body, 'TODO')).toEqual(['A', 'C', 'B']);

    // A to DONE sets completedAt; back to TODO clears it
    const done = await agent.post(`/tasks/${ids.A}/move`).send({ status: 'DONE' });
    expect(done.body.completedAt).not.toBeNull();
    const reopened = await agent.post(`/tasks/${ids.A}/move`).send({ status: 'TODO', afterId: ids.C });
    expect(reopened.body.completedAt).toBeNull();
    list = await agent.get(`/projects/${project.id}/tasks`);
    expect(titles(list.body, 'TODO')).toEqual(['A', 'C', 'B']);
  });

  it('rebalances a column when positions run out of precision', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, title: 'A', position: 1 });
    const b = await createTask({ projectId: project.id, authorId: owner.id, title: 'B', position: 1.000000001 });
    const c = await createTask({ projectId: project.id, authorId: owner.id, title: 'C', position: 5 });

    const res = await agent.post(`/tasks/${c.id}/move`).send({ status: 'TODO', beforeId: a.id, afterId: b.id });
    expect(res.status).toBe(200);
    const list = await agent.get(`/projects/${project.id}/tasks`);
    expect(titles(list.body, 'TODO')).toEqual(['A', 'C', 'B']);
  });

  it('rejects neighbours from another column', async () => {
    const { owner, project, agent } = await setup();
    const a = await createTask({ projectId: project.id, authorId: owner.id, status: 'DONE' });
    const b = await createTask({ projectId: project.id, authorId: owner.id });
    const res = await agent.post(`/tasks/${b.id}/move`).send({ status: 'TODO', beforeId: a.id });
    expect(res.status).toBe(400);
  });
});

describe('task details, editing and deletion', () => {
  it('updates fields, validates assignee membership and returns details with subtasks', async () => {
    const { owner, project, agent } = await setup();
    const member = await createUser();
    const outsider = await createUser();
    await addMember(project.id, member.id, 'MEMBER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });

    const updated = await agent.patch(`/tasks/${task.id}`).send({
      title: 'Renamed',
      priority: 'URGENT',
      assigneeId: member.id,
      dueDate: '2026-12-01T00:00:00.000Z',
      tags: ['api', 'api', ' backend '],
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      title: 'Renamed',
      priority: 'URGENT',
      assignee: { id: member.id },
      tags: ['api', 'backend'],
    });

    const bad = await agent.patch(`/tasks/${task.id}`).send({ assigneeId: outsider.id });
    expect(bad.status).toBe(400);

    await agent.post(`/projects/${project.id}/tasks`).send({ title: 'Sub 1', parentId: task.id });
    const detail = await agent.get(`/tasks/${task.id}`);
    expect(detail.body.subtasks.map((s: { title: string }) => s.title)).toEqual(['Sub 1']);
    expect(detail.body.subtaskCount).toBe(1);

    // subtasks are not listed on the board
    const board = await agent.get(`/projects/${project.id}/tasks`);
    expect(board.body).toHaveLength(1);
  });

  it('prevents nested subtasks', async () => {
    const { owner, project, agent } = await setup();
    const parent = await createTask({ projectId: project.id, authorId: owner.id });
    const child = await createTask({ projectId: project.id, authorId: owner.id, parentId: parent.id });
    const res = await agent.post(`/projects/${project.id}/tasks`).send({ title: 'x', parentId: child.id });
    expect(res.status).toBe(400);
  });

  it('lets the author or an admin delete (soft) a task and its subtasks', async () => {
    const { owner, project, agent } = await setup();
    const member = await createUser();
    await addMember(project.id, member.id, 'MEMBER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    await createTask({ projectId: project.id, authorId: owner.id, parentId: task.id });

    const asMember = await loginAs(app, member.email);
    expect((await asMember.delete(`/tasks/${task.id}`)).status).toBe(403);

    expect((await agent.delete(`/tasks/${task.id}`)).status).toBe(204);
    expect((await agent.get(`/tasks/${task.id}`)).status).toBe(404);
    expect(await prisma.task.count({ where: { deletedAt: null } })).toBe(0);
  });
});

describe('my tasks and calendar', () => {
  it('lists open tasks assigned to me across projects, and calendar ranges', async () => {
    const { owner, project, agent } = await setup();
    const other = await createProject(owner.id);
    await createTask({ projectId: project.id, authorId: owner.id, assigneeId: owner.id, dueDate: new Date('2026-10-05') });
    await createTask({ projectId: other.id, authorId: owner.id, assigneeId: owner.id, dueDate: new Date('2026-11-05') });
    await createTask({ projectId: other.id, authorId: owner.id, assigneeId: owner.id, status: 'DONE' });
    await createTask({ projectId: other.id, authorId: owner.id }); // unassigned

    const mine = await agent.get('/me/tasks');
    expect(mine.body).toHaveLength(2);
    expect(mine.body[0].project).toHaveProperty('name');

    const withDone = await agent.get('/me/tasks?includeDone=true');
    expect(withDone.body).toHaveLength(3);

    const october = await agent.get('/me/calendar?from=2026-10-01&to=2026-10-31');
    expect(october.body).toHaveLength(1);
    const tooLong = await agent.get('/me/calendar?from=2026-01-01&to=2026-12-31');
    expect(tooLong.status).toBe(400);
  });
});
