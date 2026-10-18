import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/** 1×1 PNG (real bytes so content-length checks the stored file). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('profile photo upload', () => {
  it('stores an image, serves it publicly and replaces the previous file', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const upload = await agent
      .post('/users/me/avatar')
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(upload.status).toBe(200);
    const url = upload.body.avatarUrl as string;
    expect(url).toMatch(/^\/avatars\/[0-9a-f-]{36}\.png$/);
    expect(await prisma.user.findUnique({ where: { id: user.id } }).then((u) => u?.avatarUrl)).toBe(
      url,
    );

    // Public route: no auth cookies, cacheable, correct type and size.
    const served = await request(app).get(url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
    expect(served.headers['content-length']).toBe(String(PNG.length));
    expect(served.headers['cache-control']).toContain('immutable');

    // A new upload replaces the old file and the old name stops resolving.
    const second = await agent
      .post('/users/me/avatar')
      .attach('file', PNG, { filename: 'me2.png', contentType: 'image/png' });
    expect(second.status).toBe(200);
    expect(second.body.avatarUrl).not.toBe(url);
    expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).get(second.body.avatarUrl)).status).toBe(200);
  });

  it('deletes the stored file when the photo is cleared', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const upload = await agent
      .post('/users/me/avatar')
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    const url = upload.body.avatarUrl as string;
    expect((await request(app).get(url)).status).toBe(200);

    const cleared = await agent.patch('/users/me').send({ avatarUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.avatarUrl).toBeNull();
    // The orphaned upload must stop resolving (and disappear from disk).
    expect((await request(app).get(url)).status).toBe(404);
  });

  it('rejects non-image uploads and serves only server-minted names', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const bad = await agent
      .post('/users/me/avatar')
      .attach('file', Buffer.from('not an image'), {
        filename: 'x.txt',
        contentType: 'text/plain',
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    expect((await request(app).get('/avatars/whatever.png')).status).toBe(404);
    expect((await request(app).get('/avatars/..%2F..%2Fpackage.json')).status).toBe(404);
  });

  it('requires a session', async () => {
    const res = await request(app)
      .post('/users/me/avatar')
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});

describe('daily digest report', () => {
  it('summarises my open/overdue/due-today tasks inside my projects only', async () => {
    const me = await createUser();
    const other = await createUser();
    const project = await createProject(me.id);
    const foreign = await createProject(other.id);
    const now = Date.now();

    await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'Overdue one',
      assigneeId: me.id,
      dueDate: new Date(now - 60 * 60 * 1000),
    });
    await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'Due today',
      assigneeId: me.id,
      dueDate: new Date(now + 60 * 1000),
    });
    await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'No due date',
      assigneeId: me.id,
    });
    await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'Already done',
      assigneeId: me.id,
      status: 'DONE',
      dueDate: new Date(now - 60 * 60 * 1000),
    });
    // Assigned to me but outside my projects — a digest must never leak it.
    await createTask({
      projectId: foreign.id,
      authorId: other.id,
      title: 'Foreign project task',
      assigneeId: me.id,
      dueDate: new Date(now - 60 * 60 * 1000),
    });

    const agent = await loginAs(app, me.email);
    const res = await agent.get('/dashboard/digest');
    expect(res.status).toBe(200);
    expect(res.body.open).toBe(3);
    expect(res.body.overdue).toBe(1);
    expect(res.body.dueToday).toBe(1);
    expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual([
      'Overdue one',
      'Due today',
    ]);
    expect(res.body.tasks[0].overdue).toBe(true);
    expect(res.body.tasks[1].overdue).toBe(false);
    expect(res.body.tasks[0].projectName).toBe(project.name);
    expect(new Date(res.body.generatedAt).getTime()).not.toBeNaN();
  });

  it('carries the context that makes it a report, not just a count', async () => {
    const me = await createUser();
    const project = await createProject(me.id, { name: 'Billing revamp' });
    const otherProject = await createProject(me.id, { name: 'Onboarding' });
    const now = Date.now();

    const late = await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'Late one',
      assigneeId: me.id,
      dueDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
    });
    await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'In flight',
      status: 'IN_PROGRESS',
      assigneeId: me.id,
    });
    await createTask({
      projectId: otherProject.id,
      authorId: me.id,
      title: 'Next month',
      assigneeId: me.id,
      dueDate: new Date(now + 20 * 24 * 60 * 60 * 1000),
    });
    const shipped = await createTask({
      projectId: project.id,
      authorId: me.id,
      title: 'Shipped',
      status: 'DONE',
      assigneeId: me.id,
    });
    // The factory has no completedAt field — the completion stamp is what the digest counts.
    await prisma.task.update({ where: { id: shipped.id }, data: { completedAt: new Date(now - 2 * 60 * 60 * 1000) } });

    const agent = await loginAs(app, me.email);
    const res = await agent.get('/dashboard/digest');
    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      open: 3,
      overdue: 1,
      dueToday: 0,
      dueThisWeek: 0, // the only future due date is 20 days out
      inProgress: 1,
      completedSinceYesterday: 1,
    });

    // The overdue row knows how late it is — the digest UI renders that number directly.
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ id: late.id, overdue: true, overdueByDays: 3, daysUntilDue: -3 });
    expect(res.body.overdueByDays).toBe(3);

    // Per-project split, overdue first.
    expect(res.body.perProject[0]).toEqual({
      projectId: project.id,
      projectName: 'Billing revamp',
      open: 2,
      overdue: 1,
    });
    expect(res.body.perProject[1]).toEqual({
      projectId: otherProject.id,
      projectName: 'Onboarding',
      open: 1,
      overdue: 0,
    });
  });

  it('requires a session', async () => {
    expect((await request(app).get('/dashboard/digest')).status).toBe(401);
  });
});
