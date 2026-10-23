import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const filters = { priority: 'HIGH', assigneeId: 0, groupBy: 'status' };

describe('saved views', () => {
  it('creates, lists, renames and deletes a view (scoped to its owner)', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    const created = await agent
      .post(`/projects/${project.id}/views`)
      .send({ name: '  My week  ', filters });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'My week', filters, projectId: project.id });

    const list = await agent.get(`/projects/${project.id}/views`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const renamed = await agent
      .patch(`/projects/${project.id}/views/${created.body.id}`)
      .send({ name: 'Blocked', filters: { groupBy: 'assignee' } });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'Blocked', filters: { groupBy: 'assignee' } });

    const removed = await agent.delete(`/projects/${project.id}/views/${created.body.id}`);
    expect(removed.status).toBe(204);
    expect((await agent.get(`/projects/${project.id}/views`)).body).toEqual([]);
  });

  it('rejects duplicate names and unknown filter keys', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    expect((await agent.post(`/projects/${project.id}/views`).send({ name: 'A', filters })).status).toBe(201);
    expect((await agent.post(`/projects/${project.id}/views`).send({ name: 'A', filters })).status).toBe(409);
    const unknown = await agent
      .post(`/projects/${project.id}/views`)
      .send({ name: 'B', filters: { sort: 'title' } });
    expect(unknown.status).toBe(400);
  });

  it("hides other people's views and projects", async () => {
    const me = await createUser();
    const other = await createUser();
    const project = await createProject(me.id);
    await addMember(project.id, other.id, 'MEMBER');
    const mine = await loginAs(app, me.email);
    const theirs = await loginAs(app, other.email);

    const created = await mine.post(`/projects/${project.id}/views`).send({ name: 'Mine', filters });

    // A member sees only their own views, and cannot touch someone else's by id.
    expect((await theirs.get(`/projects/${project.id}/views`)).body).toEqual([]);
    expect((await theirs.delete(`/projects/${project.id}/views/${created.body.id}`)).status).toBe(404);

    const outsider = await createUser();
    const stranger = await loginAs(app, outsider.email);
    expect((await stranger.get(`/projects/${project.id}/views`)).status).toBe(404);
  });
});
