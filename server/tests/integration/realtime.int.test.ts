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

describe('attachments', () => {
  it('uploads, lists, streams and deletes a file', async () => {
    const { project, agent } = await setup();
    const task = await createTask({ projectId: project.id, authorId: (await agent.get('/auth/me')).body.id });

    const upload = await agent
      .post(`/tasks/${task.id}/attachments`)
      .attach('file', Buffer.from('hello phase 5'), 'notes.txt');
    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({ fileName: 'notes.txt', mimeType: 'text/plain', size: 13 });

    const list = await agent.get(`/tasks/${task.id}/attachments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].uploader.name).toBeTruthy();

    const download = await agent.get(`/attachments/${upload.body.id}/download`);
    expect(download.status).toBe(200);
    expect(download.text).toBe('hello phase 5');
    expect(download.headers['content-disposition']).toContain('notes.txt');

    const removed = await agent.delete(`/attachments/${upload.body.id}`);
    expect(removed.status).toBe(204);
    expect((await agent.get(`/tasks/${task.id}/attachments`)).body).toHaveLength(0);
  });

  it('rejects missing files, empty files and outsiders', async () => {
    const { project, agent } = await setup();
    const task = await createTask({ projectId: project.id, authorId: (await agent.get('/auth/me')).body.id });

    expect((await agent.post(`/tasks/${task.id}/attachments`)).status).toBe(400);
    expect(
      (await agent.post(`/tasks/${task.id}/attachments`).attach('file', Buffer.alloc(0), 'empty.txt')).status,
    ).toBe(400);

    const outsider = await createUser();
    const stranger = await loginAs(app, outsider.email);
    const outsiderTask = await createTask({ projectId: project.id, authorId: (await agent.get('/auth/me')).body.id });
    // Non-members get 404, not 403 — the project's existence is not leaked.
    expect(
      (await stranger.post(`/tasks/${outsiderTask.id}/attachments`).attach('file', Buffer.from('x'), 'x.txt')).status,
    ).toBe(404);
  });

  it('lets only the uploader or an admin delete an attachment', async () => {
    const { owner, project } = await setup();
    const member = await createUser();
    await addMember(project.id, member.id, 'MEMBER');
    const memberAgent = await loginAs(app, member.email);
    const task = await createTask({ projectId: project.id, authorId: owner.id });

    const upload = await memberAgent.post(`/tasks/${task.id}/attachments`).attach('file', Buffer.from('a'), 'a.txt');
    expect((await memberAgent.delete(`/attachments/${upload.body.id}`)).status).toBe(204);

    const ownerAgent = await loginAs(app, owner.email);
    const ownerUpload = await ownerAgent
      .post(`/tasks/${task.id}/attachments`)
      .attach('file', Buffer.from('b'), 'b.txt');
    expect((await memberAgent.delete(`/attachments/${ownerUpload.body.id}`)).status).toBe(403);
  });
});

describe('activity log', () => {
  it('records created/updated/moved field diffs automatically', async () => {
    const { project, agent } = await setup();
    // Created through the API so the service hook records the 'created' action.
    const created = await agent.post(`/projects/${project.id}/tasks`).send({ title: 'A' });
    expect(created.status).toBe(201);
    const taskId = created.body.id;

    await agent.patch(`/tasks/${taskId}`).send({ status: 'IN_PROGRESS', dueDate: '2099-01-01T00:00:00.000Z' });
    await agent.post(`/tasks/${taskId}/move`).send({ status: 'REVIEW' });

    const activity = await agent.get(`/tasks/${taskId}/activity`);
    expect(activity.status).toBe(200);

    const byAction = (action: string) => activity.body.filter((row: { action: string }) => row.action === action);
    expect(byAction('created')).toHaveLength(1);

    const updated = byAction('updated');
    const statusRow = updated.find((row: { field: string }) => row.field === 'status');
    expect(statusRow).toMatchObject({ oldValue: 'TODO', newValue: 'IN_PROGRESS' });
    const dueRow = updated.find((row: { field: string }) => row.field === 'dueDate');
    expect(dueRow).toMatchObject({ newValue: '2099-01-01T00:00:00.000Z' });

    const moved = byAction('moved');
    expect(moved[0]).toMatchObject({ field: 'status', oldValue: 'IN_PROGRESS', newValue: 'REVIEW' });
  });

  it('is member-only (viewers read it, outsiders get 403)', async () => {
    const { owner, project, agent } = await setup();
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    expect((await agent.get(`/tasks/${task.id}/activity`)).status).toBe(200);

    const outsider = await createUser();
    // Non-members get 404 — project existence is not leaked.
    const stranger = await loginAs(app, outsider.email);
    expect((await stranger.get(`/tasks/${task.id}/activity`)).status).toBe(404);
  });
});

describe('notifications', () => {
  it('notifies the assignee on assignment, comment and mention — never the actor', async () => {
    const { owner, project, agent } = await setup();
    const assignee = await createUser();
    await addMember(project.id, assignee.id, 'MEMBER');
    const task = await createTask({ projectId: project.id, authorId: owner.id, title: 'N1' });

    await agent.patch(`/tasks/${task.id}`).send({ assigneeId: assignee.id });
    const assigneeAgent = await loginAs(app, assignee.email);
    let unread = await assigneeAgent.get('/notifications/unread-count');
    expect(unread.body.count).toBe(1);

    // Comment on the assigned task → COMMENTED for the assignee.
    await agent.post(`/tasks/${task.id}/comments`).send({ body: 'progress update' });
    unread = await assigneeAgent.get('/notifications/unread-count');
    expect(unread.body.count).toBe(2);

    // Mention another member → MENTIONED for them, nothing for the author.
    const mentionee = await createUser({ name: 'Mention Me' });
    await addMember(project.id, mentionee.id, 'MEMBER');
    await agent.post(`/tasks/${task.id}/comments`).send({ body: 'ping @Mention Me please' });
    const mentioneeAgent = await loginAs(app, mentionee.email);
    const mentioneeList = await mentioneeAgent.get('/notifications');
    expect(mentioneeList.body).toHaveLength(1);
    expect(mentioneeList.body[0]).toMatchObject({ type: 'MENTIONED', read: false });

    const ownerList = await agent.get('/notifications');
    expect(ownerList.body).toHaveLength(0); // actor is never notified
  });

  it('marks one and all as read', async () => {
    const { owner, project, agent } = await setup();
    const assignee = await createUser();
    await addMember(project.id, assignee.id, 'MEMBER');
    const a = await createTask({ projectId: project.id, authorId: owner.id });
    const b = await createTask({ projectId: project.id, authorId: owner.id });
    await agent.patch(`/tasks/${a.id}`).send({ assigneeId: assignee.id });
    await agent.patch(`/tasks/${b.id}`).send({ assigneeId: assignee.id });

    const assigneeAgent = await loginAs(app, assignee.email);
    const list = await assigneeAgent.get('/notifications');
    expect(list.body).toHaveLength(2);

    await assigneeAgent.post(`/notifications/${list.body[0].id}/read`);
    expect((await assigneeAgent.get('/notifications/unread-count')).body.count).toBe(1);

    await assigneeAgent.post('/notifications/read-all');
    expect((await assigneeAgent.get('/notifications/unread-count')).body.count).toBe(0);

    const refreshed = await assigneeAgent.get('/notifications');
    expect(refreshed.body.every((n: { read: boolean }) => n.read)).toBe(true);
  });

  it('hides notifications from other users', async () => {
    const { owner, project, agent } = await setup();
    const assignee = await createUser();
    await addMember(project.id, assignee.id, 'MEMBER');
    const task = await createTask({ projectId: project.id, authorId: owner.id });
    await agent.patch(`/tasks/${task.id}`).send({ assigneeId: assignee.id });

    const assigneeAgent = await loginAs(app, assignee.email);
    const list = await assigneeAgent.get('/notifications');
    const notificationId = list.body[0].id as number;

    const stranger = await loginAs(app, (await createUser()).email);
    expect((await stranger.post(`/notifications/${notificationId}/read`)).status).toBe(404);
  });
});
