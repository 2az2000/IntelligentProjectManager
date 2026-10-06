import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { prisma, resetDb } from '../helpers/db';
import { addMember, createProject, createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/** OpenAI-compatible chat completion envelope around `content`. */
const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('AI endpoints without a key', () => {
  it('answers 503 AI_NOT_CONFIGURED and leaves the rest of the API untouched', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);

    const res = await agent.post(`/projects/${project.id}/ai/enrich-task`).send({ title: 'Build landing page' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');

    // Health endpoint still works — a missing AI key must not break the server.
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('AI endpoints with a stubbed provider', () => {
  beforeAll(() => {
    (env as { AI_API_KEY?: string }).AI_API_KEY = 'test-key';
  });
  afterAll(() => {
    delete (env as { AI_API_KEY?: string }).AI_API_KEY;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns an enrichment preview without writing anything to the database', async () => {
    const me = await createUser();
    const backend = await createUser({ name: 'Backend Bita' });
    const project = await createProject(me.id);
    await addMember(project.id, backend.id, 'MEMBER');
    const agent = await loginAs(app, me.email);

    const fetchStub = vi.fn().mockResolvedValue(
      completion(
        JSON.stringify({
          description: 'Ship the marketing landing page.',
          subtasks: ['Wireframe', 'Copywriting', 'Implement sections'],
          assignees: [{ userId: backend.id, reason: 'Backend and integrations' }, { userId: 99999, reason: 'ghost' }],
          estimateHours: 12,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchStub);

    const res = await agent
      .post(`/projects/${project.id}/ai/enrich-task`)
      .send({ title: 'Landing page', description: 'needed for launch' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      description: 'Ship the marketing landing page.',
      subtasks: ['Wireframe', 'Copywriting', 'Implement sections'],
      suggestedAssignees: [{ userId: backend.id, name: 'Backend Bita', reason: 'Backend and integrations' }],
      estimateHours: 12,
    });
    // Preview only: no task rows were created.
    expect(await prisma.task.count()).toBe(0);
    // The member context (with skills) was sent to the provider.
    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain('userId=' + backend.id);
  });

  it('rejects providers that return broken JSON', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('I could not answer, sorry.')));

    const res = await agent.post(`/projects/${project.id}/ai/enrich-task`).send({ title: 'Something' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_BAD_RESPONSE');
  });

  it('maps provider HTTP failures to 502 AI_PROVIDER_ERROR', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));

    const res = await agent.post(`/projects/${project.id}/ai/enrich-task`).send({ title: 'Something' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
  });

  it('generates project documentation as markdown', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    const agent = await loginAs(app, me.email);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('# Project\n\n## Overview\nEverything.')));

    const res = await agent.post(`/projects/${project.id}/ai/project-doc`).send({});
    expect(res.status).toBe(200);
    expect(res.body.markdown).toContain('# Project');
    expect(res.body.model).toBe(env.AI_MODEL);
  });

  it('hides projects from non-members and blocks VIEWERs from enrichment', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);
    await addMember(project.id, viewer.id, 'VIEWER');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('{}')));

    const asStranger = await loginAs(app, stranger.email);
    const hidden = await asStranger.post(`/projects/${project.id}/ai/enrich-task`).send({ title: 'Anything' });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('PROJECT_NOT_FOUND');

    const asViewer = await loginAs(app, viewer.email);
    const denied = await asViewer.post(`/projects/${project.id}/ai/enrich-task`).send({ title: 'Anything' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('INSUFFICIENT_ROLE');

    // VIEWER can still read a generated document.
    const doc = await asViewer.post(`/projects/${project.id}/ai/project-doc`).send({});
    expect(doc.status).toBe(200);
  });
});

describe('member skills', () => {
  it('adds and edits skills (self or admin), while plain members cannot edit others', async () => {
    const owner = await createUser();
    const dev = await createUser();
    const other = await createUser();
    const project = await createProject(owner.id);
    const ownerAgent = await loginAs(app, owner.email);

    const added = await ownerAgent
      .post(`/projects/${project.id}/members`)
      .send({ userId: dev.id, role: 'MEMBER', skills: ['backend', 'api'] });
    expect(added.status).toBe(201);
    expect(added.body.skills).toEqual(['backend', 'api']);

    const selfEdit = await (await loginAs(app, dev.email))
      .patch(`/projects/${project.id}/members/${dev.id}`)
      .send({ skills: ['backend', 'devops'] });
    expect(selfEdit.status).toBe(200);
    expect(selfEdit.body.skills).toEqual(['backend', 'devops']);

    await addMember(project.id, other.id, 'MEMBER');
    const otherEdit = await (await loginAs(app, other.email))
      .patch(`/projects/${project.id}/members/${dev.id}`)
      .send({ skills: ['frontend'] });
    expect(otherEdit.status).toBe(403);

    const empty = await ownerAgent.patch(`/projects/${project.id}/members/${dev.id}`).send({});
    expect(empty.status).toBe(400);
  });
});
