import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await createUser({ name: 'Owner' });
  const member = await createUser({ name: 'Sara' });
  const project = await createProject(owner.id);
  await addMember(project.id, member.id, 'MEMBER');
  const task = await createTask({ projectId: project.id, authorId: owner.id });
  return { owner, member, project, task };
}

describe('comment reactions', () => {
  it('toggles the same emoji off, groups by emoji and keeps the fixed order', async () => {
    const { owner, member, task } = await setup();
    const asOwner = await loginAs(app, owner.email);
    const asMember = await loginAs(app, member.email);

    const created = await asOwner.post(`/tasks/${task.id}/comments`).send({ body: 'Shipping today?' });
    expect(created.status).toBe(201);
    expect(created.body.reactions).toEqual([]);

    const commentId = created.body.id as number;
    const first = await asMember.post(`/comments/${commentId}/reactions`).send({ emoji: '👍' });
    expect(first.status).toBe(200);
    expect(first.body.reactions).toEqual([
      { emoji: '👍', users: [{ id: member.id, name: 'Sara', avatarUrl: null }] },
    ]);

    // A second person joins the same emoji — one chip, two names.
    await asOwner.post(`/comments/${commentId}/reactions`).send({ emoji: '👍' });
    // And a second emoji is ordered by the allowlist, not by insertion.
    await asOwner.post(`/comments/${commentId}/reactions`).send({ emoji: '🎉' });

    const list = await asOwner.get(`/tasks/${task.id}/comments`);
    expect(list.body[0].reactions).toEqual([
      {
        emoji: '👍',
        users: [
          { id: member.id, name: 'Sara', avatarUrl: null },
          { id: owner.id, name: 'Owner', avatarUrl: null },
        ],
      },
      { emoji: '🎉', users: [{ id: owner.id, name: 'Owner', avatarUrl: null }] },
    ]);

    // Toggling the same emoji again removes just that one person's reaction.
    const removed = await asMember.post(`/comments/${commentId}/reactions`).send({ emoji: '👍' });
    expect(removed.body.reactions[0]).toEqual({
      emoji: '👍',
      users: [{ id: owner.id, name: 'Owner', avatarUrl: null }],
    });
    expect(await prisma.commentReaction.count()).toBe(2);
  });

  it('rejects emoji outside the allowlist and non-members', async () => {
    const { owner, task } = await setup();
    const outsider = await createUser({ name: 'Outsider' });
    const asOwner = await loginAs(app, owner.email);
    const comment = await asOwner.post(`/tasks/${task.id}/comments`).send({ body: 'hi' });

    const bad = await asOwner
      .post(`/comments/${comment.body.id}/reactions`)
      .send({ emoji: '🍕' });
    expect(bad.status).toBe(400);

    const asOutsider = await loginAs(app, outsider.email);
    const denied = await asOutsider
      .post(`/comments/${comment.body.id}/reactions`)
      .send({ emoji: '👍' });
    expect(denied.status).toBe(404);
  });

  it('drops reactions with the comment (no orphan rows)', async () => {
    const { owner, task } = await setup();
    const asOwner = await loginAs(app, owner.email);
    const comment = await asOwner.post(`/tasks/${task.id}/comments`).send({ body: 'bye' });
    await asOwner.post(`/comments/${comment.body.id}/reactions`).send({ emoji: '🚀' });
    expect(await prisma.commentReaction.count()).toBe(1);

    await prisma.comment.delete({ where: { id: comment.body.id } });
    expect(await prisma.commentReaction.count()).toBe(0);
  });
});

describe('mentions', () => {
  it('notifies a mentioned member once, and never the author', async () => {
    const { owner, member, task } = await setup();
    const asOwner = await loginAs(app, owner.email);

    // The autocomplete inserts `@Full Name`; the server matches that against member names.
    const res = await asOwner
      .post(`/tasks/${task.id}/comments`)
      .send({ body: `@Sara can you check this? CC @Owner` });
    expect(res.status).toBe(201);

    const notifications = await prisma.notification.findMany({
      where: { type: 'MENTIONED', taskId: task.id },
      select: { userId: true },
    });
    expect(notifications.map((n) => n.userId)).toEqual([member.id]);
  });
});
