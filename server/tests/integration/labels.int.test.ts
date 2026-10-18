import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const BACKEND = { name: 'Backend', color: '#2563eb', icon: 'server' };

async function scenario() {
  const owner = await createUser();
  const project = await createProject(owner.id);
  const agent = await loginAs(app, owner.email);
  return { owner, project, agent };
}

describe('project labels', () => {
  it('creates, lists, renames and deletes labels', async () => {
    const { project, agent } = await scenario();

    expect((await agent.get(`/projects/${project.id}/labels`)).body).toEqual([]);

    const created = await agent.post(`/projects/${project.id}/labels`).send(BACKEND);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Backend', color: '#2563eb', icon: 'server' });

    await agent.post(`/projects/${project.id}/labels`).send({ name: 'Security', color: '#dc2626', icon: 'shield' });
    // Alphabetical: the picker shows the vocabulary in a stable order.
    expect((await agent.get(`/projects/${project.id}/labels`)).body.map((l: { name: string }) => l.name)).toEqual([
      'Backend',
      'Security',
    ]);

    const renamed = await agent
      .patch(`/projects/${project.id}/labels/${created.body.id}`)
      .send({ name: 'API', color: '#16a34a' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'API', color: '#16a34a', icon: 'server' });

    expect((await agent.delete(`/projects/${project.id}/labels/${created.body.id}`)).status).toBe(204);
    expect((await agent.get(`/projects/${project.id}/labels`)).body).toHaveLength(1);
  });

  it('keeps the vocabulary unique per project and rejects bad colours/icons', async () => {
    const { project, agent } = await scenario();
    await agent.post(`/projects/${project.id}/labels`).send(BACKEND);

    const duplicate = await agent.post(`/projects/${project.id}/labels`).send(BACKEND);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('LABEL_EXISTS');

    // Renaming onto another label's name is a conflict too.
    const security = await agent
      .post(`/projects/${project.id}/labels`)
      .send({ name: 'Security', color: '#dc2626', icon: 'shield' });
    const clash = await agent
      .patch(`/projects/${project.id}/labels/${security.body.id}`)
      .send({ name: 'Backend' });
    expect(clash.status).toBe(409);

    expect((await agent.post(`/projects/${project.id}/labels`).send({ ...BACKEND, name: 'X', color: 'blue' })).status).toBe(400);
    expect(
      (await agent.post(`/projects/${project.id}/labels`).send({ ...BACKEND, name: 'X', icon: 'not-an-icon' })).status,
    ).toBe(400);
    // Whitespace-only names are not labels.
    expect((await agent.post(`/projects/${project.id}/labels`).send({ ...BACKEND, name: '   ' })).status).toBe(400);
  });

  it('renames the matching tag on the project tasks, and only that project', async () => {
    const { owner, project, agent } = await scenario();
    const otherProject = await createProject(owner.id, { name: 'Other' });
    const label = await agent.post(`/projects/${project.id}/labels`).send(BACKEND);

    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Wire the API', tags: ['Backend', 'urgent'] });
    expect(task.status).toBe(201);

    // A same-named tag in a different project is not touched by this project's vocabulary.
    const foreign = await createTask({ projectId: otherProject.id, authorId: owner.id, title: 'Elsewhere' });
    await prisma.task.update({ where: { id: foreign.id }, data: { tags: ['Backend'] } });

    const renamed = await agent.patch(`/projects/${project.id}/labels/${label.body.id}`).send({ name: 'API' });
    expect(renamed.status).toBe(200);

    const after = await prisma.task.findUnique({ where: { id: task.body.id }, select: { tags: true } });
    expect(after?.tags).toEqual(['API', 'urgent']);
    expect(
      (await prisma.task.findUnique({ where: { id: foreign.id }, select: { tags: true } }))?.tags,
    ).toEqual(['Backend']);
  });

  it('deleting a label leaves the tags on tasks alone', async () => {
    const { project, agent } = await scenario();
    const label = await agent.post(`/projects/${project.id}/labels`).send(BACKEND);
    const task = await agent.post(`/projects/${project.id}/tasks`).send({ title: 'T', tags: ['Backend'] });

    expect((await agent.delete(`/projects/${project.id}/labels/${label.body.id}`)).status).toBe(204);
    expect((await prisma.task.findUnique({ where: { id: task.body.id }, select: { tags: true } }))?.tags).toEqual([
      'Backend',
    ]);
  });

  it('lets VIEWERs read the vocabulary but not change it', async () => {
    const { owner, project } = await scenario();
    const viewer = await createUser();
    await addMember(project.id, viewer.id, 'VIEWER');
    const viewerAgent = await loginAs(app, viewer.email);

    expect((await viewerAgent.get(`/projects/${project.id}/labels`)).status).toBe(200);
    expect((await viewerAgent.post(`/projects/${project.id}/labels`).send(BACKEND)).status).toBe(403);

    const stranger = await createUser();
    expect((await (await loginAs(app, stranger.email)).get(`/projects/${project.id}/labels`)).status).toBe(404);
    expect(owner.id).toBeGreaterThan(0);
  });
});
