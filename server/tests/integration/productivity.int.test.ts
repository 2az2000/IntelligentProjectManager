import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { createProject, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('rich text descriptions', () => {
  it('sanitizes HTML on create and keeps the plain twin for search', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    const res = await agent.post(`/projects/${project.id}/tasks`).send({
      title: 'Docs',
      descriptionHtml: '<p>Hello <strong>team</strong></p><script>alert(1)</script>',
    });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Hello team');
    expect(res.body.descriptionHtml).toBe('<p>Hello <strong>team</strong></p>');
  });

  it('updates via HTML and clears both fields when emptied', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);
    const task = await agent
      .post(`/projects/${project.id}/tasks`)
      .send({ title: 'Docs', description: 'plain' });

    const filled = await agent
      .patch(`/tasks/${task.body.id}`)
      .send({ descriptionHtml: '<ul><li>first</li><li>second</li></ul>' });
    expect(filled.status).toBe(200);
    expect(filled.body.description).toBe('first\nsecond');

    const cleared = await agent.patch(`/tasks/${task.body.id}`).send({ descriptionHtml: '<p></p>' });
    expect(cleared.body.descriptionHtml).toBeNull();
    expect(cleared.body.description).toBeNull();
  });
});

describe('WIP limits', () => {
  it('stores per-column limits and clears them with null', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    const set = await agent
      .patch(`/projects/${project.id}`)
      .send({ columnLimits: { IN_PROGRESS: 3, '  ': 9 } });
    expect(set.status).toBe(200);
    expect(set.body.columnLimits).toEqual({ IN_PROGRESS: 3 });

    const list = await agent.get('/projects');
    expect(list.body[0].columnLimits).toEqual({ IN_PROGRESS: 3 });

    const cleared = await agent.patch(`/projects/${project.id}`).send({ columnLimits: null });
    expect(cleared.body.columnLimits).toBeNull();
  });
});

describe('onboarding flag', () => {
  it('stamps onboardedAt on the profile', async () => {
    const me = await createUser();
    const agent = await loginAs(app, me.email);

    const res = await agent.patch('/users/me').send({ onboardedAt: '2026-10-21T10:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.onboardedAt).toBe('2026-10-21T10:00:00.000Z');

    const meAgain = await agent.get('/auth/me');
    expect(meAgain.body.onboardedAt).toBe('2026-10-21T10:00:00.000Z');
  });
});
