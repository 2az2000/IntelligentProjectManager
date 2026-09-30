import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /health', () => {
  it('reports database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('projects', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('creates a project owned by the current user and lists only own projects', async () => {
    const me = await createUser();
    const other = await createUser();
    await createProject(other.id, { name: 'Not mine' });
    const agent = await loginAs(app, me.email);

    const created = await agent.post('/projects').send({ name: '  Launch  ', description: 'Q1' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Launch', ownerId: me.id, myRole: 'OWNER' });

    const list = await agent.get('/projects');
    expect(list.body.map((p: { name: string }) => p.name)).toEqual(['Launch']);
  });

  it('rejects invalid and unknown fields (no mass assignment of ownerId)', async () => {
    const me = await createUser();
    const agent = await loginAs(app, me.email);
    expect((await agent.post('/projects').send({ name: '' })).status).toBe(400);
    expect((await agent.post('/projects').send({ name: 'x', ownerId: 99 })).status).toBe(400);
    const dates = await agent
      .post('/projects')
      .send({ name: 'x', startDate: '2026-02-01', endDate: '2026-01-01' });
    expect(dates.status).toBe(400);
  });

  it("hides other users' projects behind 404", async () => {
    const me = await createUser();
    const other = await createUser();
    const project = await createProject(other.id);
    const agent = await loginAs(app, me.email);

    const res = await agent.get(`/projects/${project.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('tasks', () => {
  it('creates tasks with the session user as author', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    const created = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Write docs', priority: 'HIGH' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Write docs',
      status: 'TODO',
      author: { id: me.id },
    });

    const list = await agent.get(`/projects/${project.id}/tasks`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toHaveProperty('assignee', null);
  });

  it('does not accept authorId from the client', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);
    const res = await agent.post(`/projects/${project.id}/tasks`).send({ title: 't', authorId: 5 });
    expect(res.status).toBe(400);
  });

  it('enforces project roles', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, viewer.id, 'VIEWER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });

    const asViewer = await loginAs(app, viewer.email);
    expect((await asViewer.get(`/projects/${project.id}/tasks`)).status).toBe(200);
    const create = await asViewer.post(`/projects/${project.id}/tasks`).send({ title: 't' });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('INSUFFICIENT_ROLE');

    const asStranger = await loginAs(app, stranger.email);
    expect((await asStranger.get(`/projects/${project.id}/tasks`)).status).toBe(404);
    const move = await asStranger.post(`/tasks/${task.id}/move`).send({ status: 'DONE' });
    expect(move.status).toBe(404);
  });
});
