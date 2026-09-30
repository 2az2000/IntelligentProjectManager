import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { TEST_PASSWORD, addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('projects: update, delete, stats', () => {
  it('returns stats and owner, allows admins to edit and only the owner to delete', async () => {
    const owner = await createUser({ name: 'Owner' });
    const admin = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, admin.id, 'ADMIN');
    await createTask({ projectId: project.id, authorId: owner.id, status: 'DONE' });
    await createTask({ projectId: project.id, authorId: owner.id, dueDate: new Date('2020-01-01') });

    const asOwner = await loginAs(app, owner.email);
    const detail = await asOwner.get(`/projects/${project.id}`);
    expect(detail.body).toMatchObject({
      owner: { name: 'Owner' },
      memberCount: 2,
      stats: { total: 2, done: 1, overdue: 1 },
    });

    const asAdmin = await loginAs(app, admin.email);
    const edited = await asAdmin.patch(`/projects/${project.id}`).send({ name: 'Renamed', description: null });
    expect(edited.status).toBe(200);
    expect(edited.body.name).toBe('Renamed');
    expect((await asAdmin.delete(`/projects/${project.id}`)).status).toBe(403);

    expect((await asOwner.delete(`/projects/${project.id}`)).status).toBe(204);
    expect((await asOwner.get(`/projects/${project.id}`)).status).toBe(404);
    expect((await asOwner.get('/projects')).body).toHaveLength(0);
  });
});

describe('members', () => {
  it('adds, re-roles and removes members according to the rules', async () => {
    const owner = await createUser();
    const admin = await createUser();
    const newbie = await createUser({ name: 'Newbie' });
    const project = await createProject(owner.id);
    await addMember(project.id, admin.id, 'ADMIN');
    const asAdmin = await loginAs(app, admin.email);

    const added = await asAdmin.post(`/projects/${project.id}/members`).send({ userId: newbie.id });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ role: 'MEMBER', user: { name: 'Newbie' } });

    const dup = await asAdmin.post(`/projects/${project.id}/members`).send({ userId: newbie.id });
    expect(dup.status).toBe(409);

    // admin cannot promote to admin; owner can
    expect(
      (await asAdmin.patch(`/projects/${project.id}/members/${newbie.id}`).send({ role: 'ADMIN' })).body.error.code,
    ).toBe('ONLY_OWNER_MANAGES_ADMINS');
    const asOwner = await loginAs(app, owner.email);
    expect(
      (await asOwner.patch(`/projects/${project.id}/members/${newbie.id}`).send({ role: 'ADMIN' })).status,
    ).toBe(200);

    // nobody can remove the owner
    expect((await asOwner.delete(`/projects/${project.id}/members/${owner.id}`)).status).toBe(403);

    // removing a member unassigns their tasks
    const task = await createTask({ projectId: project.id, authorId: owner.id, assigneeId: newbie.id, points: 5 });
    const members = await asOwner.get(`/projects/${project.id}/members`);
    expect(members.body.find((m: { user: { id: number } }) => m.user.id === newbie.id)).toMatchObject({
      openTasks: 1,
      openPoints: 5,
    });
    expect((await asOwner.delete(`/projects/${project.id}/members/${newbie.id}`)).status).toBe(204);
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.assigneeId).toBeNull();
  });

  it('builds a team view across my projects', async () => {
    const me = await createUser();
    const mate = await createUser();
    const p1 = await createProject(me.id);
    const p2 = await createProject(me.id);
    await addMember(p1.id, mate.id, 'MEMBER');
    await addMember(p2.id, mate.id, 'MEMBER');
    await createTask({ projectId: p1.id, authorId: me.id, assigneeId: mate.id, points: 3 });
    await createTask({ projectId: p2.id, authorId: me.id, assigneeId: mate.id, points: 2, dueDate: new Date('2020-01-01') });

    const team = await (await loginAs(app, me.email)).get('/me/team');
    expect(team.body[0]).toMatchObject({
      user: { id: mate.id },
      projectCount: 2,
      openTasks: 2,
      openPoints: 5,
      overdueTasks: 1,
    });
  });
});

describe('comments', () => {
  it('lets members comment and authors edit/delete', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, viewer.id, 'VIEWER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    const asOwner = await loginAs(app, owner.email);
    const asViewer = await loginAs(app, viewer.email);

    const created = await asOwner.post(`/tasks/${task.id}/comments`).send({ body: ' Hello ' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ body: 'Hello', author: { id: owner.id } });

    expect((await asViewer.post(`/tasks/${task.id}/comments`).send({ body: 'x' })).status).toBe(403);
    expect((await asViewer.get(`/tasks/${task.id}/comments`)).body).toHaveLength(1);
    expect((await asViewer.patch(`/comments/${created.body.id}`).send({ body: 'hack' })).status).toBe(403);

    const edited = await asOwner.patch(`/comments/${created.body.id}`).send({ body: 'Edited' });
    expect(edited.body.body).toBe('Edited');
    expect((await asOwner.get(`/tasks/${task.id}`)).body.commentCount).toBe(1);

    expect((await asOwner.delete(`/comments/${created.body.id}`)).status).toBe(204);
    expect((await asOwner.get(`/tasks/${task.id}/comments`)).body).toHaveLength(0);
  });
});

describe('users and account', () => {
  it('searches users, updates the profile and changes the password', async () => {
    const me = await createUser({ name: 'Me Myself', email: 'me@test.dev' });
    await createUser({ name: 'Sara Ahmadi', email: 'sara@test.dev' });
    const agent = await loginAs(app, me.email);

    const found = await agent.get('/users?search=sara');
    expect(found.body).toEqual([expect.objectContaining({ name: 'Sara Ahmadi', email: 'sara@test.dev' })]);
    expect((await agent.get('/users?search=s')).status).toBe(400);

    const profile = await agent.patch('/users/me').send({ name: 'New Name', locale: 'en', theme: 'dark' });
    expect(profile.body).toMatchObject({ name: 'New Name', locale: 'en', theme: 'dark' });
    expect((await agent.patch('/users/me').send({ avatarUrl: 'javascript:alert(1)' })).status).toBe(400);

    const wrong = await agent
      .post('/auth/change-password')
      .send({ currentPassword: 'nope', newPassword: 'NewPassword1!' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const ok = await agent
      .post('/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPassword1!' });
    expect(ok.status).toBe(204);
    expect((await agent.get('/auth/me')).status).toBe(200); // current session keeps working
    await expect(loginAs(app, me.email)).rejects.toThrow(); // old password no longer works
    await loginAs(app, me.email, 'NewPassword1!');
  });
});

describe('dashboard', () => {
  it('summarises my work', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    await createTask({ projectId: project.id, authorId: me.id, assigneeId: me.id, dueDate: new Date('2020-01-01') });
    await createTask({ projectId: project.id, authorId: me.id, assigneeId: me.id, dueDate: new Date(Date.now() + 2 * 86400000) });
    await createTask({ projectId: project.id, authorId: me.id, status: 'DONE' });

    const res = await (await loginAs(app, me.email)).get('/dashboard/summary');
    expect(res.body).toMatchObject({
      projectCount: 1,
      myOpenTasks: 2,
      overdue: 1,
      dueThisWeek: 1,
      byStatus: { TODO: 2, IN_PROGRESS: 0, REVIEW: 0, DONE: 1 },
    });
    expect(res.body.upcoming).toHaveLength(2);
    expect(res.body.recentProjects[0].id).toBe(project.id);
  });
});
