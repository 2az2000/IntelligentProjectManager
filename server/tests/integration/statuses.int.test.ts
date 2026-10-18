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

const keys = (body: { key: string }[]) => body.map((status) => status.key);
const titles = (body: { title: string; statusKey: string }[], statusKey: string) =>
  body.filter((task) => task.statusKey === statusKey).map((task) => task.title);

describe('project statuses', () => {
  it('starts every project with the four built-in columns, in order', async () => {
    const { project, agent } = await setup();
    const res = await agent.get(`/projects/${project.id}/statuses`);
    expect(res.status).toBe(200);
    expect(keys(res.body)).toEqual(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
    expect(res.body.map((s: { category: string }) => s.category)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'DONE',
    ]);
  });

  it('inserts a custom column exactly where it is asked to sit (QA between dev and release)', async () => {
    const { project, agent } = await setup();
    // A project that renames its columns keeps the built-in keys.
    const created = await agent
      .post(`/projects/${project.id}/statuses`)
      .send({ label: 'QA', color: '#f59e0b', category: 'IN_PROGRESS', afterKey: 'IN_PROGRESS' });
    expect(created.status).toBe(201);
    expect(created.body.key).toBe('QA');
    expect(created.body.label).toBe('QA');

    const list = await agent.get(`/projects/${project.id}/statuses`);
    expect(keys(list.body)).toEqual(['TODO', 'IN_PROGRESS', 'QA', 'REVIEW', 'DONE']);
  });

  it('appends by default and rewrites the order from a reorder call', async () => {
    const { project, agent } = await setup();
    await agent
      .post(`/projects/${project.id}/statuses`)
      .send({ label: 'Release', color: '#0ea5e9', category: 'DONE' });

    const list = await agent.get(`/projects/${project.id}/statuses`);
    expect(keys(list.body)).toEqual(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'RELEASE']);

    const reordered = await agent
      .post(`/projects/${project.id}/statuses/reorder`)
      .send({ keys: ['TODO', 'IN_PROGRESS', 'REVIEW', 'RELEASE', 'DONE'] });
    expect(reordered.status).toBe(200);
    expect(keys(reordered.body)).toEqual(['TODO', 'IN_PROGRESS', 'REVIEW', 'RELEASE', 'DONE']);

    // A partial/duplicated list is rejected instead of silently scrambling the board.
    const bad = await agent
      .post(`/projects/${project.id}/statuses/reorder`)
      .send({ keys: ['TODO', 'IN_PROGRESS'] });
    expect(bad.status).toBe(400);
  });

  it('keeps the task key and its analytics bucket in sync', async () => {
    const { owner, project, agent } = await setup();
    const qa = await agent
      .post(`/projects/${project.id}/statuses`)
      .send({ label: 'QA', color: '#f59e0b', category: 'IN_PROGRESS', afterKey: 'IN_PROGRESS' });
    const qaKey = qa.body.key;

    const created = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Regression pass', statusKey: qaKey });
    expect(created.status).toBe(201);
    expect(created.body.statusKey).toBe(qaKey);
    expect(created.body.status).toBe('IN_PROGRESS');

    // Moving to the DONE column sets completedAt and the DONE bucket together.
    const done = await agent.post(`/tasks/${created.body.id}/move`).send({ statusKey: 'DONE' });
    expect(done.status).toBe(200);
    expect(done.body.statusKey).toBe('DONE');
    expect(done.body.status).toBe('DONE');
    expect(done.body.completedAt).not.toBeNull();

    // A key that belongs to another project is a validation error, never a silent default.
    const other = await createProject(owner.id);
    const foreign = await agent
      .post(`/projects/${other.id}/tasks`)
      .send({ title: 'Elsewhere', statusKey: qaKey });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('re-buckets the tasks of a column whose category changes', async () => {
    const { owner, project, agent } = await setup();
    const review = await prisma.projectStatus.findFirstOrThrow({
      where: { projectId: project.id, key: 'REVIEW' },
    });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'Needs sign-off', status: 'REVIEW', statusKey: 'REVIEW' });

    const res = await agent
      .patch(`/projects/${project.id}/statuses/${review.id}`)
      .send({ category: 'DONE' });
    expect(res.status).toBe(200);

    const task = await prisma.task.findFirstOrThrow({ where: { projectId: project.id } });
    expect(task.statusKey).toBe('REVIEW');
    expect(task.status).toBe('DONE');
    expect(task.completedAt).not.toBeNull();
  });

  it('refuses to delete a column that still holds tasks unless they are moved', async () => {
    const { owner, project, agent } = await setup();
    const review = await prisma.projectStatus.findFirstOrThrow({
      where: { projectId: project.id, key: 'REVIEW' },
    });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'In review', statusKey: 'REVIEW' });

    const blocked = await agent.delete(`/projects/${project.id}/statuses/${review.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('STATUS_IN_USE');

    const moved = await agent.delete(
      `/projects/${project.id}/statuses/${review.id}?moveToKey=IN_PROGRESS`,
    );
    expect(moved.status).toBe(204);
    const task = await prisma.task.findFirstOrThrow({ where: { projectId: project.id } });
    expect(task.statusKey).toBe('IN_PROGRESS');
    expect(task.status).toBe('IN_PROGRESS');
  });

  it('keeps the vocabulary admin-only and hides other projects', async () => {
    const { project } = await setup();
    const member = await createUser();
    await addMember(project.id, member.id, 'MEMBER');
    const memberAgent = await loginAs(app, member.email);

    expect((await memberAgent.get(`/projects/${project.id}/statuses`)).status).toBe(200);
    const denied = await memberAgent
      .post(`/projects/${project.id}/statuses`)
      .send({ label: 'Ops', color: '#64748b', category: 'TODO' });
    expect(denied.status).toBe(403);

    const stranger = await loginAs(app, (await createUser()).email);
    expect((await stranger.get(`/projects/${project.id}/statuses`)).status).toBe(404);
  });

  it('filters tasks by workflow column', async () => {
    const { owner, project, agent } = await setup();
    await createTask({ projectId: project.id, authorId: owner.id, title: 'Ship it', statusKey: 'DONE', status: 'DONE' });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'Start it', statusKey: 'TODO' });

    const res = await agent.get(`/projects/${project.id}/tasks?statusKey=DONE`);
    expect(res.status).toBe(200);
    expect(titles(res.body, 'DONE')).toEqual(['Ship it']);
  });
});
