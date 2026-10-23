import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { prisma, resetDb } from '../helpers/db';
import { createProject, createTask, createUser, loginAs } from '../helpers/factories';

/**
 * §AI semantic search over pgvector. The provider is stubbed with deterministic one-hot vectors,
 * so similarity is exact and the test proves the storage → SQL → merge path, not the model.
 */
const app = createApp({ db: prisma });

const DIM = 1536;

const oneHot = (at: number) => Array.from({ length: DIM }, (_, index) => (index === at ? 1 : 0));

/** Keyword → axis; the query "authentication issue" shares axis 0 with the login task. */
const axisOf = (text: string) => {
  if (/landing/i.test(text)) return 1;
  if (/database/i.test(text)) return 2;
  return 0;
};

const embeddingResponse = (texts: string[]) =>
  new Response(
    JSON.stringify({
      data: texts.map((text, index) => ({ index, embedding: oneHot(axisOf(text)) })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const embedStub = () =>
  vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { input: string[] };
    return embeddingResponse(body.input);
  });

let savedEmbeddingKey: string | undefined;
let savedAiKey: string | undefined;

beforeAll(() => {
  const mutable = env as { AI_EMBEDDING_API_KEY?: string; AI_API_KEY?: string };
  savedEmbeddingKey = mutable.AI_EMBEDDING_API_KEY;
  savedAiKey = mutable.AI_API_KEY;
  delete mutable.AI_EMBEDDING_API_KEY;
  delete mutable.AI_API_KEY;
});

afterAll(async () => {
  const mutable = env as { AI_EMBEDDING_API_KEY?: string; AI_API_KEY?: string };
  mutable.AI_EMBEDDING_API_KEY = savedEmbeddingKey;
  mutable.AI_API_KEY = savedAiKey;
  await prisma.$disconnect();
});

beforeEach(resetDb);
afterEach(() => vi.unstubAllGlobals());

async function setupProjectWithTasks() {
  const owner = await createUser();
  const project = await createProject(owner.id, { name: 'Storefront' });
  const login = await createTask({ projectId: project.id, authorId: owner.id, title: 'Fix login redirect' });
  const landing = await createTask({ projectId: project.id, authorId: owner.id, title: 'Design landing page' });
  const migration = await createTask({ projectId: project.id, authorId: owner.id, title: 'Database migration' });
  const agent = await loginAs(app, owner.email);
  return { owner, project, agent, login, landing, migration };
}

describe('semantic search without an embedding provider', () => {
  it('reports the feature as unavailable and keeps search lexical', async () => {
    const { project, agent } = await setupProjectWithTasks();

    const status = await agent.get('/search/status');
    expect(status.status).toBe(200);
    expect(status.body.semantic.available).toBe(false);

    const res = await agent.get('/search').query({ q: 'login' });
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ match: 'keyword', title: 'Fix login redirect' });
    expect(res.body.semantic).toMatchObject({
      requested: true,
      available: false,
      used: false,
      reason: 'not_configured',
    });

    const backfill = await agent.post(`/projects/${project.id}/ai/embeddings/backfill`).send({});
    expect(backfill.status).toBe(503);
    expect(backfill.body.error.code).toBe('AI_EMBEDDING_NOT_CONFIGURED');
  });
});

describe('semantic search with a stubbed embedding provider', () => {
  beforeAll(() => {
    (env as { AI_EMBEDDING_API_KEY?: string }).AI_EMBEDDING_API_KEY = 'test-embedding-key';
  });
  afterAll(() => {
    delete (env as { AI_EMBEDDING_API_KEY?: string }).AI_EMBEDDING_API_KEY;
  });

  it('embeds existing tasks and returns nearest neighbours the keyword pass missed', async () => {
    const { project, agent, login } = await setupProjectWithTasks();
    const fetchStub = embedStub();
    vi.stubGlobal('fetch', fetchStub);

    const status = await agent.get('/search/status');
    expect(status.body.semantic).toMatchObject({ available: true, model: env.AI_EMBEDDING_MODEL });

    const backfill = await agent.post(`/projects/${project.id}/ai/embeddings/backfill`).send({});
    expect(backfill.status).toBe(200);
    expect(backfill.body).toEqual({ embedded: 3, failed: 0, total: 3 });

    // No task title contains "authentication", so only the vector pass can find it.
    const lexical = await agent.get('/search').query({ q: 'authentication issue', semantic: 'false' });
    expect(lexical.body.tasks).toEqual([]);
    expect(lexical.body.semantic.used).toBe(false);

    const res = await agent.get('/search').query({ q: 'authentication issue' });
    expect(res.status).toBe(200);
    expect(res.body.semantic).toMatchObject({ requested: true, available: true, used: true });
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({
      id: login.id,
      title: 'Fix login redirect',
      match: 'semantic',
    });
    expect(res.body.tasks[0]!.similarity).toBeCloseTo(1, 5);
    // The provider saw the task text, in batch order.
    const bodies = fetchStub.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { input: string[] });
    expect(bodies[0]!.input).toEqual(
      expect.arrayContaining([expect.stringContaining('Fix login redirect')]),
    );
  });

  it('only searches the caller’s projects', async () => {
    const { agent } = await setupProjectWithTasks();
    const outsider = await createUser({ name: 'Outsider' });
    const otherProject = await createProject(outsider.id, { name: 'Secret project' });
    await createTask({ projectId: otherProject.id, authorId: outsider.id, title: 'Login audit for secrets' });
    vi.stubGlobal('fetch', embedStub());

    const outsiderAgent = await loginAs(app, outsider.email);
    expect((await outsiderAgent.post(`/projects/${otherProject.id}/ai/embeddings/backfill`).send({})).body.embedded).toBe(1);

    const res = await outsiderAgent.get('/search').query({ q: 'authentication issue' });
    expect(res.body.tasks.every((task: { projectId: number }) => task.projectId === otherProject.id)).toBe(true);

    const asOwnerOfFirst = await agent.get('/search').query({ q: 'authentication issue' });
    expect(asOwnerOfFirst.body.tasks.every((task: { projectId: number }) => task.projectId !== otherProject.id)).toBe(true);
  });

  it('degrades to lexical with a reason when the provider returns wrong dimensions', async () => {
    const { agent } = await setupProjectWithTasks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const res = await agent.get('/search').query({ q: 'authentication issue' });
    expect(res.status).toBe(200);
    expect(res.body.semantic).toMatchObject({ used: false, reason: 'provider_error' });
  });
});
