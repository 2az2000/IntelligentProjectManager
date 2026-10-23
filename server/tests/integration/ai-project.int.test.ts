import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createTask, createUser, loginAs } from '../helpers/factories';

/**
 * §AI project chat and the weekly project report — both read-only, role-scoped, and grounded in
 * real rows. The provider is stubbed; these tests assert what we send and what we refuse to send.
 */
const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const providerBody = (fetchStub: ReturnType<typeof vi.fn>, call = 0) => {
  const [, init] = fetchStub.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
};

describe('AI project chat', () => {
  beforeAll(() => {
    (env as { AI_API_KEY?: string }).AI_API_KEY = 'test-key';
  });
  afterAll(() => {
    delete (env as { AI_API_KEY?: string }).AI_API_KEY;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('answers from a role-scoped project snapshot and sends the conversation history', async () => {
    const owner = await createUser({ name: 'Owner One' });
    const project = await createProject(owner.id, { name: 'Checkout revamp' });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'Fix payment redirect', estimateHours: 6 });
    const agent = await loginAs(app, owner.email);

    const fetchStub = vi.fn().mockResolvedValue(completion('**Fix payment redirect** is unassigned.'));
    vi.stubGlobal('fetch', fetchStub);

    const res = await agent.post(`/projects/${project.id}/ai/chat`).send({
      messages: [
        { role: 'user', content: 'What is still open?' },
        { role: 'assistant', content: 'One task is open.' },
        { role: 'user', content: 'Who owns it?' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ answer: '**Fix payment redirect** is unassigned.', model: env.AI_MODEL });

    const body = providerBody(fetchStub);
    const system = body.messages[0]!.content;
    expect(system).toContain('read-only');
    expect(system).toContain('Checkout revamp');
    expect(system).toContain('Fix payment redirect');
    expect(system).toContain('role=OWNER');
    // The whole bounded history travels, in order, after the snapshot.
    expect(body.messages.slice(1)).toEqual([
      { role: 'user', content: 'What is still open?' },
      { role: 'assistant', content: 'One task is open.' },
      { role: 'user', content: 'Who owns it?' },
    ]);
  });

  it('lets a VIEWER ask questions and hides the project from strangers', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, viewer.id, 'VIEWER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('Nothing is overdue.')));

    const asViewer = await loginAs(app, viewer.email);
    const viewerRes = await asViewer
      .post(`/projects/${project.id}/ai/chat`)
      .send({ messages: [{ role: 'user', content: 'Anything overdue?' }] });
    expect(viewerRes.status).toBe(200);

    const asStranger = await loginAs(app, stranger.email);
    const hidden = await asStranger
      .post(`/projects/${project.id}/ai/chat`)
      .send({ messages: [{ role: 'user', content: 'Anything overdue?' }] });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('rejects an empty conversation, an assistant-last turn and oversized history', async () => {
    const owner = await createUser();
    const project = await createProject(owner.id);
    const agent = await loginAs(app, owner.email);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('unused')));

    const empty = await agent.post(`/projects/${project.id}/ai/chat`).send({ messages: [] });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const assistantLast = await agent.post(`/projects/${project.id}/ai/chat`).send({
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ],
    });
    expect(assistantLast.status).toBe(400);

    const tooMuch = await agent.post(`/projects/${project.id}/ai/chat`).send({
      messages: [{ role: 'user', content: 'x'.repeat(4001) }],
    });
    expect(tooMuch.status).toBe(400);
  });
});

describe('AI weekly summary', () => {
  beforeAll(() => {
    (env as { AI_API_KEY?: string }).AI_API_KEY = 'test-key';
  });
  afterAll(() => {
    delete (env as { AI_API_KEY?: string }).AI_API_KEY;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports the real numbers for the last seven days and asks for the fixed sections', async () => {
    const owner = await createUser();
    const project = await createProject(owner.id, { name: 'Mobile app' });
    await createTask({ projectId: project.id, authorId: owner.id, title: 'Ship onboarding', estimateHours: 8 });
    const agent = await loginAs(app, owner.email);

    const fetchStub = vi.fn().mockResolvedValue(completion('## What moved\n- Onboarding shipped'));
    vi.stubGlobal('fetch', fetchStub);

    const res = await agent.post(`/projects/${project.id}/ai/weekly-summary`).send({});
    expect(res.status).toBe(200);
    expect(res.body.markdown).toContain('## What moved');
    expect(res.body.model).toBe(env.AI_MODEL);
    expect(res.body.stats).toMatchObject({ created: 1, completed: 0, open: 1, overdue: 0, blocked: 0 });
    expect(new Date(res.body.range.from).getTime()).toBeLessThan(new Date(res.body.range.to).getTime());

    const body = providerBody(fetchStub);
    expect(body.messages[0]!.content).toContain('What moved');
    expect(body.messages[1]!.content).toContain('Mobile app');
    expect(body.messages[1]!.content).toContain('Ship onboarding');
    expect(body.messages[1]!.content).toContain('completed=0');
    // A report is read-only: no task or comment was written by generating it.
    expect(await prisma.task.count()).toBe(1);
  });

  it('is readable by a VIEWER and invisible to a stranger', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, viewer.id, 'VIEWER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('## Focus\n- Keep going')));

    const viewerRes = await (await loginAs(app, viewer.email))
      .post(`/projects/${project.id}/ai/weekly-summary`)
      .send({});
    expect(viewerRes.status).toBe(200);

    const hidden = await (await loginAs(app, stranger.email))
      .post(`/projects/${project.id}/ai/weekly-summary`)
      .send({});
    expect(hidden.status).toBe(404);
  });
});
