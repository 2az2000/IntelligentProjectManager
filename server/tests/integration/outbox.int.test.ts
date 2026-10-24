import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { MAX_ATTEMPTS, OutboxService } from '../../src/modules/outbox';
import { prisma, resetDb } from '../helpers/db';
import { createProject, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });
const newOutbox = () => new OutboxService(prisma);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('outbox', () => {
  it('stores the event unpublished and drains it to every subscriber', async () => {
    const outbox = newOutbox();
    const seen: unknown[] = [];
    outbox.on('task.changed', (payload) => {
      seen.push(payload);
    });

    await outbox.emit(prisma, 'task.changed', {
      projectId: 1,
      taskId: 2,
      kind: 'updated',
      actorId: 3,
    });
    const stored = await prisma.domainEvent.findFirstOrThrow();
    expect(stored.publishedAt).toBeNull();
    expect(stored.payload).toEqual({ projectId: 1, taskId: 2, kind: 'updated', actorId: 3 });

    expect(await outbox.drain()).toEqual({ published: 1, failed: 0 });
    expect(seen).toEqual([{ projectId: 1, taskId: 2, kind: 'updated', actorId: 3 }]);

    const delivered = await prisma.domainEvent.findFirstOrThrow();
    expect(delivered.publishedAt).not.toBeNull();
    expect(delivered.attempts).toBe(0);
  });

  it('retries a failed delivery and records why it failed', async () => {
    const outbox = newOutbox();
    let calls = 0;
    outbox.on('task.assigned', () => {
      calls += 1;
      if (calls === 1) throw new Error('socket down');
    });

    await outbox.emit(prisma, 'task.assigned', { userId: 1, projectId: 2, taskId: 3, actorId: 4 });

    expect(await outbox.drain()).toEqual({ published: 0, failed: 1 });
    const failed = await prisma.domainEvent.findFirstOrThrow();
    expect(failed.publishedAt).toBeNull();
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe('socket down');

    // The retry runs the subscriber again and only then marks the event published.
    expect(await outbox.drain()).toEqual({ published: 1, failed: 0 });
    expect(calls).toBe(2);
  });

  it('gives up after MAX_ATTEMPTS instead of retrying forever', async () => {
    const outbox = newOutbox();
    outbox.on('task.changed', () => {
      throw new Error('always down');
    });
    await outbox.emit(prisma, 'task.changed', {
      projectId: 1,
      taskId: 1,
      kind: 'created',
      actorId: 1,
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) await outbox.drain();

    const event = await prisma.domainEvent.findFirstOrThrow();
    expect(event.attempts).toBe(MAX_ATTEMPTS);
    expect(event.publishedAt).toBeNull();
    expect(await outbox.drain()).toEqual({ published: 0, failed: 0 });
  });

  it('commits the event in the same transaction as the state change', async () => {
    const outbox = newOutbox();

    await expect(
      prisma.$transaction(async (tx) => {
        await outbox.emit(tx, 'task.changed', {
          projectId: 1,
          taskId: 1,
          kind: 'created',
          actorId: 1,
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(await prisma.domainEvent.count()).toBe(0);
  });

  it('prunes delivered events past the retention window', async () => {
    const outbox = newOutbox();
    outbox.on('task.changed', () => undefined);
    await outbox.emit(prisma, 'task.changed', {
      projectId: 1,
      taskId: 1,
      kind: 'created',
      actorId: 1,
    });
    await outbox.drain();

    expect(await outbox.prune(new Date(Date.now() + 1_000))).toBe(1);
    expect(await prisma.domainEvent.count()).toBe(0);
  });

  it('is wired into task writes: no unpublished rows survive a request', async () => {
    const me = await createUser();
    const project = await createProject(me.id, { name: 'Outbox' });
    const agent = await loginAs(app, me.email);

    const created = await agent.post(`/projects/${project.id}/tasks`).send({ title: 'Emit me' });
    expect(created.status).toBe(201);

    expect(await prisma.domainEvent.count()).toBeGreaterThan(0);
    expect(await prisma.domainEvent.count({ where: { publishedAt: null } })).toBe(0);
  });
});
