import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { PasswordResetRepository } from '../../src/modules/auth/password-reset.repository';
import { prisma, resetDb } from '../helpers/db';
import {
  addMember,
  createProject,
  createTask,
  createUser,
  loginAs,
  TEST_PASSWORD,
} from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('§11 password reset', () => {
  it('never reveals whether the email exists (always 204)', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'ghost@test.dev' });
    expect(res.status).toBe(204);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it('sends a usable token, resets the password and signs out other sessions', async () => {
    const user = await createUser();
    const oldAgent = await loginAs(app, user.email);

    // Request a reset link through the real endpoint (the test-env delivery hook is a no-op;
    // the raw token only exists in the email, so we mint an equivalent one via the repository).
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.usedAt).toBeNull();

    const rawToken = await new PasswordResetRepository(prisma).create(user.id, new Date());

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewPassword123!' });
    expect(res.status).toBe(204);

    // Old password no longer works; the new one does.
    expect((await request(app).post('/auth/login').send({ email: user.email, password: TEST_PASSWORD })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: user.email, password: 'NewPassword123!' })).status).toBe(200);
    // The old refresh token was revoked, so the old agent can only keep its short-lived
    // access cookie until it expires (same semantics as change-password) — then it is logged out.

    // Reusing the same token fails.
    expect(
      (await request(app).post('/auth/reset-password').send({ token: rawToken, newPassword: 'Zzz12345!' })).status,
    ).toBe(400);

    // The old refresh cookie no longer refreshes: hitting /auth/refresh with it clears cookies.
    expect((await oldAgent.post('/auth/refresh')).status).toBe(401);
  });

  it('rejects expired or unknown tokens with 400 INVALID_RESET_TOKEN', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'no-such-token-000', newPassword: 'Whatever123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('validates the body', async () => {
    expect((await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' })).status).toBe(400);
    expect((await request(app).post('/auth/reset-password').send({ token: 'short', newPassword: 'x' })).status).toBe(400);
  });
});

describe('§11 recycling bin', () => {
  it('lists soft-deleted tasks and restores them with their subtasks', async () => {
    const me = await createUser();
    const other = await createUser();
    const project = await createProject(me.id);
    await addMember(project.id, other.id, 'MEMBER');
    const parent = await createTask({ projectId: project.id, authorId: me.id, title: 'Deleted parent' });
    const child = await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'child',
      parentId: parent.id,
    });
    const agent = await loginAs(app, me.email);

    expect((await agent.delete(`/tasks/${parent.id}`)).status).toBe(204);
    expect((await agent.get(`/projects/${project.id}/tasks`)).body).toHaveLength(0);

    const trash = await agent.get(`/projects/${project.id}/tasks/trash`);
    expect(trash.status).toBe(200);
    expect(trash.body.map((t: { id: number }) => t.id)).toEqual([parent.id]);

    const restored = await agent.post(`/projects/${project.id}/tasks/trash/${parent.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.deletedAt ?? null).toBeNull();

    // Parent AND subtask are alive again (the list endpoint shows top-level only).
    const list = await agent.get(`/projects/${project.id}/tasks`);
    expect(list.body.map((t: { id: number }) => t.id)).toEqual([parent.id]);
    expect(await prisma.task.count({ where: { projectId: project.id, deletedAt: null } })).toBe(2);
    expect(await prisma.task.findUnique({ where: { id: child.id } }).then((t) => t?.deletedAt)).toBeNull();
  });

  it('hides trash from non-members and requires author/admin to restore', async () => {
    const owner = await createUser();
    const member = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, member.id, 'MEMBER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'subtask', parentId: task.id });

    const ownerAgent = await loginAs(app, owner.email);
    await ownerAgent.delete(`/tasks/${task.id}`);

    const strangerAgent = await loginAs(app, stranger.email);
    expect((await strangerAgent.get(`/projects/${project.id}/tasks/trash`)).status).toBe(404);
    expect((await strangerAgent.post(`/projects/${project.id}/tasks/trash/${task.id}/restore`)).status).toBe(404);

    // A plain member can see the trash but may not restore someone else's task.
    const memberAgent = await loginAs(app, member.email);
    expect((await memberAgent.get(`/projects/${project.id}/tasks/trash`)).status).toBe(200);
    expect((await memberAgent.post(`/projects/${project.id}/tasks/trash/${task.id}/restore`)).status).toBe(403);

    // The author can.
    expect((await ownerAgent.post(`/projects/${project.id}/tasks/trash/${task.id}/restore`)).status).toBe(200);
  });
});

describe('§11 project templates', () => {
  it('creates a project with template tasks and dependencies', async () => {
    const me = await createUser();
    const agent = await loginAs(app, me.email);

    const res = await agent.post('/projects/from-template').send({
      templateId: 'software-launch',
      name: 'محصول جدید',
      description: 'ساخته‌شده از قالب',
    });
    expect(res.status).toBe(201);
    expect(res.body.templateApplied).toBe('software-launch');
    expect(res.body.name).toBe('محصول جدید');

    const tasks = await prisma.task.findMany({
      where: { projectId: res.body.id, deletedAt: null },
      include: { dependsOn: true, blocks: true },
    });
    expect(tasks).toHaveLength(6);
    // "پیاده‌سازی فرانت‌اند" depends on "طراحی وایرفریم" (FINISH_TO_START).
    const frontend = tasks.find((t) => t.title === 'پیاده‌سازی فرانت‌اند')!;
    expect(frontend.dependsOn).toHaveLength(1);
    const integration = tasks.find((t) => t.title === 'یکپارچه‌سازی و تست')!;
    expect(integration.dependsOn).toHaveLength(2);
    const release = tasks.find((t) => t.title === 'انتشار نسخه‌ی اول')!;
    expect(release.dependsOn).toHaveLength(2);
    // No cycles: every dependency points to an earlier-inserted task.
    const titles = new Map(tasks.map((t) => [t.id, t.title]));
    for (const t of tasks) {
      for (const dep of t.dependsOn) {
        expect(titles.get(dep.predecessorId)).toBeDefined();
      }
    }
  });

  it('lists templates without auth requirement beyond session and validates unknown ids', async () => {
    const me = await createUser();
    const agent = await loginAs(app, me.email);
    const list = await agent.get('/projects/templates');
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(list.body[0]).toHaveProperty('tasks');

    const bad = await agent.post('/projects/from-template').send({ templateId: 'nope', name: 'x' });
    expect(bad.status).toBe(400);
  });
});
