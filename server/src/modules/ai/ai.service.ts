import { z } from 'zod';
import { env } from '../../config/env';
import { AppError, NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import type { ProjectRole } from '../projects';
import type {
  AiAssigneeSuggestion,
  EnrichedTask,
  ProjectDocResult,
  StandupResult,
  ThreadSummaryResult,
} from './ai.types';

/** What the AI module needs from the projects module (same contract tasks uses). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

type ChatMessage = { role: 'system' | 'user'; content: string };

interface ChatOptions {
  messages: ChatMessage[];
  /** Ask the provider for a JSON object (enrich) vs free markdown (doc). */
  json: boolean;
}

/** One provider+model pairing the chat chain may fall back through. */
interface Candidate {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Project facts handed to the model — kept narrow on purpose (no secrets, no bodies). */
interface EnrichContext {
  project: { name: string; description: string | null };
  recentTasks: { title: string; status: string }[];
  members: { userId: number; role: string; skills: string[]; user: { name: string }; openTasks: number }[];
}

interface DocContext {
  project: { name: string; description: string | null; startDate: Date | null; endDate: Date | null };
  members: { role: string; skills: string[]; user: { name: string } }[];
  tasks: {
    title: string;
    status: string;
    priority: string;
    estimateHours: number | null;
    dueDate: Date | null;
    assignee: { name: string } | null;
    subtasks: { title: string; status: string }[];
  }[];
}

const notConfigured = () =>
  new AppError(
    503,
    'AI_NOT_CONFIGURED',
    'AI is not configured on this server: set AI_API_KEY (optionally AI_BASE_URL and AI_MODEL)',
  );

/**
 * A rate limit gets its own code and status: it is a "come back shortly" condition, not a broken
 * feature, and the client can show that difference (plus how long the provider asked us to wait).
 */
/**
 * The provider's own words, for our logs. Bounded because a gateway can answer with an HTML
 * error page, and short because the raw body is not something a user should ever see.
 */
async function upstreamMessage(res: Response): Promise<string | null> {
  try {
    const text = (await res.text()).slice(0, 2000);
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      const err = parsed.error;
      const message =
        typeof err === 'string'
          ? err
          : typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message?: unknown }).message
            : parsed.message;
      if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
    } catch {
      // Not JSON — fall through to the raw snippet.
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    return null;
  }
}

/**
 * Maps a provider answer onto our own error vocabulary.
 *
 * The mapping is deliberately fine-grained: "the AI is unavailable" is the same sentence for a
 * retired model slug, a revoked key and an empty balance, yet each needs a different fix. The
 * upstream status and message are logged once, here, so the server terminal tells the operator
 * which one it is.
 */
async function providerError(res: Response, candidate: Candidate): Promise<AppError> {
  const upstream = await upstreamMessage(res);
  logger.error(
    { status: res.status, model: candidate.model, provider: candidate.baseUrl, upstream },
    'AI provider rejected the request',
  );
  const details = upstream ? { providerMessage: upstream } : null;

  if (res.status === 429) {
    const hinted = retryAfterSeconds(res);
    return new AppError(
      429,
      'AI_RATE_LIMITED',
      'The AI provider rate-limited this request (free tiers cap how often they may be called)',
      { ...(details ?? {}), ...(hinted !== null ? { retryAfterSeconds: hinted } : {}) },
    );
  }
  if (res.status === 401 || res.status === 403) {
    return new AppError(503, 'AI_AUTH_FAILED', 'The AI provider rejected our API key', details);
  }
  if (res.status === 402) {
    return new AppError(503, 'AI_QUOTA_EXCEEDED', 'The AI provider account is out of credit', details);
  }
  // A retired/unknown slug answers 404 — and OpenRouter also reports "no endpoints" as a 400.
  const looksLikeModelMiss = res.status === 404 || /no endpoints|model|endpoint/i.test(upstream ?? '');
  if (res.status === 404 || (res.status === 400 && looksLikeModelMiss)) {
    return new AppError(
      503,
      'AI_MODEL_NOT_FOUND',
      `The AI model "${candidate.model}" is not available on this provider`,
      details,
    );
  }
  return new AppError(502, 'AI_PROVIDER_ERROR', `The AI provider responded with HTTP ${res.status}`, details);
}

/**
 * How long the provider asks us to wait, in seconds. OpenAI-compatible gateways send either
 * `Retry-After` or the reset timestamp of their own rate-limit window (OpenRouter's
 * `x-ratelimit-reset` is a Unix time in seconds). Both are honoured when present.
 */
function retryAfterSeconds(res: Response): number | null {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) {
    const until = (reset > 1e12 ? reset : reset * 1000) - Date.now();
    if (until > 0) return Math.ceil(until / 1000);
  }
  return null;
}

// ---- LLM output validation (the model's answer is untrusted input) --------

const rawEnrichSchema = z.object({
  description: z.string().max(4000).optional(),
  subtasks: z.array(z.string().min(1).max(200)).max(12).optional(),
  assignees: z
    .array(
      z.object({
        userId: z.number().int().positive(),
        reason: z.string().max(300).optional(),
      }),
    )
    .max(5)
    .optional(),
});

const rawTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(6).optional(),
});

/** Strips markdown fences and extracts the first JSON object from an LLM answer. */
function extractJson(content: string): unknown {
  const unfenced = content.replace(/```(?:json)?/gi, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(unfenced.slice(start, end + 1));
}

export class AiService {
  constructor(
    private readonly db: Db,
    private readonly access: ProjectAccess,
    /** Injectable so tests can stub the provider without a key or network. */
    private readonly fetchImpl?: typeof fetch,
  ) {}

  /**
   * Preview for the "add task with AI" flow: completes a rough task with a description,
   * subtask titles and assignee suggestions. The client decides what
   * to keep; applying happens through the normal task endpoints (preview-then-apply).
   */
  async enrichTask(
    userId: number,
    projectId: number,
    input: { title: string; description?: string },
  ): Promise<EnrichedTask> {
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const [ctx, requester] = await Promise.all([
      this.buildContext(projectId),
      this.db.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    ]);
    const content = await this.chat({
      json: true,
      messages: [
        { role: 'system', content: ENRICH_SYSTEM_PROMPT },
        { role: 'user', content: renderEnrichTask(ctx, input, languageOf(requester?.locale)) },
      ],
    });
    return this.parseEnrichment(content, ctx.members);
  }

  /** Full project documentation as Markdown, generated from live project data. */
  async generateProjectDoc(userId: number, projectId: number): Promise<ProjectDocResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const [ctx, requester] = await Promise.all([
      this.buildDocContext(projectId),
      this.db.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    ]);
    const markdown = await this.chat({
      json: false,
      messages: [
        { role: 'system', content: DOC_SYSTEM_PROMPT },
        { role: 'user', content: renderProjectDoc(ctx, languageOf(requester?.locale)) },
      ],
    });
    return { markdown: markdown.trim(), model: env.AI_MODEL };
  }

  /** §2 stand-up assistant: yesterday/today/blockers from the user's own activity. */
  async standup(userId: number, projectId: number, date?: Date): Promise<StandupResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const day = date ?? new Date();
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
    const dayEnd = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

    const [events, openTasks, requester] = await Promise.all([
      this.db.activityLog.findMany({
        where: { actorId: userId, task: { projectId }, createdAt: { gte: dayStart, lt: dayEnd } },
        select: { action: true, field: true, oldValue: true, newValue: true, createdAt: true, task: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.db.task.findMany({
        // The user's own work: tasks they lead plus the ones they share as a co-assignee.
        where: {
          projectId,
          deletedAt: null,
          status: { not: 'DONE' },
          OR: [{ assigneeId: userId }, { collaborators: { some: { userId } } }],
        },
        select: { title: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
        take: 15,
      }),
      this.db.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    ]);

    const markdown = await this.chat({
      json: false,
      messages: [
        { role: 'system', content: STANDUP_SYSTEM_PROMPT },
        {
          role: 'user',
          content: renderStandup(
            events.map((e) => ({
              action: e.action,
              field: e.field,
              newValue: e.newValue,
              taskTitle: e.task.title,
            })),
            openTasks.map((t) => ({ title: t.title, status: t.status, dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null })),
            languageOf(requester?.locale),
          ),
        },
      ],
    });
    return { markdown: markdown.trim(), model: env.AI_MODEL };
  }

  /** §2 long-thread summary — input is the comment array, output Markdown. */
  async summarizeThread(
    userId: number,
    taskId: number,
  ): Promise<ThreadSummaryResult> {
    const task = await this.db.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
      select: { projectId: true, title: true },
    });
    if (!task) throw new NotFoundError('TASK_NOT_FOUND', 'Task not found');
    await this.access.assertRole(task.projectId, userId, 'VIEWER');

    const comments = await this.db.comment.findMany({
      where: { taskId, deletedAt: null },
      select: { body: true, author: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    if (comments.length < 2) {
      throw new AppError(400, 'THREAD_TOO_SHORT', 'Not enough comments to summarize');
    }
    const requester = await this.db.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const markdown = await this.chat({
      json: false,
      messages: [
        { role: 'system', content: THREAD_SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: renderThreadSummary(
            task.title,
            comments.map((c) => ({ author: c.author.name, body: c.body.slice(0, 500) })),
            languageOf(requester?.locale),
          ),
        },
      ],
    });
    return { markdown: markdown.trim(), model: env.AI_MODEL };
  }

  /** §2 auto-tagging: propose tags from the project's existing tag vocabulary only. */
  async suggestTags(userId: number, projectId: number, input: { title: string; description?: string }): Promise<{ tags: string[] }> {
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const requester = await this.db.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const rows = await this.db.task.findMany({
      where: { projectId, deletedAt: null },
      select: { tags: true },
      take: 200,
    });
    const tagPool = [...new Set(rows.flatMap((r) => r.tags))].slice(0, 60);
    if (tagPool.length === 0) return { tags: [] };

    const content = await this.chat({
      json: true,
      messages: [
        { role: 'system', content: TAGS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: renderTags(tagPool, input, languageOf(requester?.locale)),
        },
      ],
    });
    let raw: unknown;
    try {
      raw = extractJson(content);
    } catch {
      throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI did not return valid JSON');
    }
    const parsed = rawTagsSchema.safeParse(raw);
    if (!parsed.success) throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an unexpected shape');
    const allowed = new Set(tagPool);
    const tags = [...new Set((parsed.data.tags ?? []).map((t) => t.trim()).filter(Boolean))]
      .filter((t) => allowed.has(t))
      .slice(0, 5);
    return { tags };
  }

  // ---- LLM plumbing -----------------------------------------------------------------------

  /**
   * The order the chat chain walks: the primary model, then AI_FALLBACK_MODELS on the same
   * provider, then the second provider (AI_FALLBACK_*) when its key is configured.
   */
  private candidates(): Candidate[] {
    const primary = { baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY ?? '', model: env.AI_MODEL };
    const list: Candidate[] = env.AI_API_KEY ? [primary] : [];
    if (env.AI_API_KEY) {
      for (const model of env.AI_FALLBACK_MODELS) list.push({ ...primary, model });
    }
    if (env.AI_FALLBACK_API_KEY) {
      list.push({
        baseUrl: env.AI_FALLBACK_BASE_URL ?? env.AI_BASE_URL,
        apiKey: env.AI_FALLBACK_API_KEY,
        model: env.AI_FALLBACK_MODEL ?? env.AI_MODEL,
      });
    }
    return list;
  }

  /**
   * Asks each candidate in turn. Rate limits, 5xx answers and unreachable providers move on to
   * the next candidate; a malformed model answer does not (another model would need a different
   * prompt) and a timeout does not either, because making the user wait twice is worse than
   * failing fast.
   *
   * Only the head of the chain gets the full retry budget: a fallback is a safety net, not a
   * second main path, and retrying every candidate would turn one stuck request into a
   * ten-second wait. The FIRST error is the one reported — it names the configured model and
   * key, which is the thing an operator actually has to fix.
   */
  private async chat(opts: ChatOptions): Promise<string> {
    const candidates = this.candidates();
    if (candidates.length === 0) throw notConfigured();

    let firstError: AppError | null = null;
    for (const [index, candidate] of candidates.entries()) {
      try {
        return await this.complete(candidate, opts, index === 0 ? env.AI_RETRY_ATTEMPTS : 0);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        if (error.code === 'AI_BAD_RESPONSE' || error.code === 'AI_TIMEOUT') throw error;
        firstError ??= error;
      }
    }
    throw firstError ?? new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider responded with an error');
  }

  /** One candidate with `retries` allowed for retryable answers. */
  private async complete(candidate: Candidate, opts: ChatOptions, retries: number): Promise<string> {
    const body: Record<string, unknown> = {
      model: candidate.model,
      messages: opts.messages,
      temperature: 0.3,
    };
    if (opts.json) body.response_format = { type: 'json_object' };
    // OpenRouter's own remedy for its "upstream_provider_shared_pool" 429 is provider routing:
    // ask it to favour the endpoint that is answering fastest instead of the one our account
    // happened to land on. Sent only to OpenRouter — other OpenAI-compatible gateways reject
    // unknown top-level fields.
    if (candidate.baseUrl.includes('openrouter.ai')) {
      body.provider = { sort: 'throughput', allow_fallbacks: true };
    }

    for (let attempt = 1; ; attempt += 1) {
      const res = await this.request(candidate, body);

      if (res.ok) {
        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an empty response');
        return content;
      }

      // Some OpenAI-compatible providers reject response_format — retry once without it.
      if (res.status === 400 && body.response_format) {
        delete body.response_format;
        continue;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt <= retries) {
        await this.backoff(attempt, res);
        continue;
      }
      throw await providerError(res, candidate);
    }
  }

  /** Waits before the next attempt, honouring the provider's own retry hint when it sends one. */
  private async backoff(attempt: number, res: Response): Promise<void> {
    const hinted = retryAfterSeconds(res);
    const ms = Math.min(hinted !== null ? hinted * 1000 : env.AI_RETRY_BASE_MS * 2 ** (attempt - 1), 10_000);
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request(candidate: Candidate, body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      return await (this.fetchImpl ?? globalThis.fetch)(`${candidate.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${candidate.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new AppError(504, 'AI_TIMEOUT', 'The AI provider took too long to answer');
      }
      throw new AppError(502, 'AI_PROVIDER_ERROR', 'Could not reach the AI provider');
    } finally {
      clearTimeout(timer);
    }
  }

  private parseEnrichment(
    content: string,
    members: { userId: number; user: { name: string } }[],
  ): EnrichedTask {
    let raw: unknown;
    try {
      raw = extractJson(content);
    } catch {
      throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI did not return valid JSON');
    }
    const parsed = rawEnrichSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an unexpected shape');
    }
    const data = parsed.data;
    const memberById = new Map(members.map((m) => [m.userId, m.user.name]));
    const subtasks = [...new Set((data.subtasks ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
    const suggestedAssignees: AiAssigneeSuggestion[] = [];
    for (const a of data.assignees ?? []) {
      // Suggestions pointing at non-members are dropped, never trusted blindly.
      const name = memberById.get(a.userId);
      if (name) suggestedAssignees.push({ userId: a.userId, name, reason: (a.reason ?? '').trim() });
    }
    return {
      description: (data.description ?? '').trim(),
      subtasks,
      suggestedAssignees,
    };
  }

  // ---- project context (the data the model is allowed to know) -----------------------------

  private async buildContext(projectId: number): Promise<EnrichContext> {
    const [project, members, workload, sharedWorkload, recentTasks] = await Promise.all([
      this.db.project.findUnique({
        where: { id: projectId },
        select: { name: true, description: true },
      }),
      this.db.projectMember.findMany({
        where: { projectId },
        select: { userId: true, role: true, skills: true, user: { select: { name: true } } },
        orderBy: { role: 'asc' },
      }),
      this.db.task.groupBy({
        by: ['assigneeId'],
        where: { projectId, deletedAt: null, status: { not: 'DONE' }, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      // Tasks a member only shares (co-assignee) still count as load when suggesting owners.
      this.db.taskCollaborator.groupBy({
        by: ['userId'],
        where: { task: { projectId, deletedAt: null, status: { not: 'DONE' } } },
        _count: { _all: true },
      }),
      this.db.task.findMany({
        where: { projectId, deletedAt: null, parentId: null },
        select: { title: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

    const openByUser = new Map(workload.map((w) => [w.assigneeId, w._count._all]));
    const sharedByUser = new Map(sharedWorkload.map((w) => [w.userId, w._count._all]));
    return {
      project,
      recentTasks,
      members: members.map((m) => ({
        ...m,
        openTasks: (openByUser.get(m.userId) ?? 0) + (sharedByUser.get(m.userId) ?? 0),
      })),
    };
  }

  private async buildDocContext(projectId: number): Promise<DocContext> {
    const [project, members, tasks] = await Promise.all([
      this.db.project.findUnique({
        where: { id: projectId },
        select: { name: true, description: true, startDate: true, endDate: true },
      }),
      this.db.projectMember.findMany({
        where: { projectId },
        select: { role: true, skills: true, user: { select: { name: true } } },
        orderBy: { role: 'asc' },
      }),
      this.db.task.findMany({
        where: { projectId, deletedAt: null, parentId: null },
        select: {
          title: true,
          status: true,
          priority: true,
          estimateHours: true,
          dueDate: true,
          assignee: { select: { name: true } },
          subtasks: { where: { deletedAt: null }, select: { title: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    ]);
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');
    return { project, members, tasks };
  }
}

// ---- prompts & rendering -------------------------------------------------------------------

const languageOf = (locale?: string) => (locale === 'en' ? 'English' : 'Persian (Farsi)');

const ENRICH_SYSTEM_PROMPT = [
  'You are a senior project manager inside a project management API.',
  'Given a rough task title and project context, respond with a JSON object with exactly these keys:',
  '- "description": a concise, actionable description (2-6 sentences)',
  '- "subtasks": 3-8 ordered, concrete subtask titles (strings)',
  '- "assignees": up to 3 objects {"userId": number, "reason": string} — only members whose',
  '  role or skills fit the work, ordered by best fit; omit the key if nobody fits',
  'Rules: userId MUST be copied exactly from the member list; never invent members, ids or facts.',
  'Respond with JSON only — no prose around it.',
].join('\n');

const DOC_SYSTEM_PROMPT = [
  'You are a technical writer. Produce complete project documentation as GitHub-flavored Markdown',
  'covering: overview & goals, scope, team & responsibilities, work breakdown (from the task list),',
  'timeline & milestones (use the provided dates, if any), risks, and suggested next steps.',
  'Base every statement ONLY on the provided data — never invent tasks, people or dates.',
  'Return Markdown only, starting with a top-level title.',
].join('\n');

const STANDUP_SYSTEM_PROMPT = [
  'You are a stand-up assistant. Produce a short Markdown stand-up report with exactly three',
  'sections as H3 headings: "Yesterday", "Today", "Blockers". Yesterday = what the user did',
  '(from activity). Today = what they should pick up next (from their open tasks, nearest due first).',
  'Blockers = anything visible in the data (overdue, stuck in one status) or "none visible".',
  'Never invent activity. Return Markdown only.',
].join('\n');

const THREAD_SUMMARY_SYSTEM_PROMPT = [
  'You summarize long task comment threads. Produce a short Markdown summary with the key',
  'decisions, open questions and action items as bullet lists. Attribute claims to authors.',
  'Never invent content. Return Markdown only.',
].join('\n');

const TAGS_SYSTEM_PROMPT = [
  'You suggest task tags. You are given the project\'s existing tag vocabulary — pick 0-5 tags',
  'from THAT list that fit the task. Never invent new tags. Respond with JSON: {"tags": string[]}.',
].join('\n');

function renderMembers(
  members: { userId?: number; role: string; skills: string[]; user: { name: string }; openTasks?: number }[],
): string {
  return members
    .map((m) => {
      const id = m.userId === undefined ? '' : `userId=${m.userId} `;
      const load = m.openTasks === undefined ? '' : `, openTasks=${m.openTasks}`;
      return `- ${id}${m.user.name} (role=${m.role}, skills=${m.skills.join('/') || 'none'}${load})`;
    })
    .join('\n');
}

function renderEnrichTask(
  ctx: Awaited<ReturnType<AiService['buildContext']>>,
  input: { title: string; description?: string },
  language: string,
): string {
  return [
    `# Task to complete`,
    `Title: ${input.title}`,
    input.description ? `Rough description: ${input.description}` : '',
    '',
    `# Project context (the only source of truth)`,
    `Project: ${ctx.project.name}`,
    ctx.project.description ? `About: ${ctx.project.description}` : '',
    `Members:\n${renderMembers(ctx.members) || 'none'}`,
    `Existing top-level tasks (newest first):`,
    ctx.recentTasks.map((t) => `- [${t.status}] ${t.title}`).join('\n') || 'none',
    '',
    `Write the description and subtask titles in ${language}.`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function renderStandup(
  events: { action: string; field: string | null; newValue: string | null; taskTitle: string }[],
  openTasks: { title: string; status: string; dueDate: string | null }[],
  language: string,
): string {
  return [
    `# My activity since yesterday (most recent first)`,
    events.length > 0
      ? events.map((e) => `- [${e.action}${e.field ? `:${e.field}` : ''}] ${e.taskTitle}${e.newValue ? ` → ${e.newValue}` : ''}`).join('\n')
      : '(no recorded activity yesterday)',
    '',
    `# My open tasks (nearest due first)`,
    openTasks.length > 0
      ? openTasks.map((t) => `- [${t.status}] ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}`).join('\n')
      : '(none assigned)',
    '',
    `Write the stand-up in ${language}.`,
  ].join('\n');
}

function renderThreadSummary(
  taskTitle: string,
  comments: { author: string; body: string }[],
  language: string,
): string {
  return [
    `# Task: ${taskTitle}`,
    '',
    `# Comment thread (${comments.length} comments, chronological)`,
    comments.map((c) => `- ${c.author}: ${c.body.replace(/\n/g, ' ')}`).join('\n'),
    '',
    `Write the summary in ${language}.`,
  ].join('\n');
}

function renderTags(
  tagPool: string[],
  input: { title: string; description?: string },
  language: string,
): string {
  return [
    `# Existing tag vocabulary (the ONLY allowed tags)`,
    tagPool.join(', ') || '(none)',
    '',
    `# Task`,
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description.slice(0, 400)}` : '',
    '',
    `(Tag strings may be written in ${language} where the vocabulary itself is in that language.)`,
  ].join('\n');
}

function renderProjectDoc(
  ctx: Awaited<ReturnType<AiService['buildDocContext']>>,
  language: string,
): string {
  const lines = [
    `# Project data`,
    `Name: ${ctx.project.name}`,
    ctx.project.description ? `Description: ${ctx.project.description}` : '',
    ctx.project.startDate ? `Start: ${ctx.project.startDate.toISOString().slice(0, 10)}` : '',
    ctx.project.endDate ? `Deadline: ${ctx.project.endDate.toISOString().slice(0, 10)}` : '',
    '',
    `Team:\n${renderMembers(ctx.members) || 'none'}`,
    '',
    `Tasks:`,
  ];
  for (const t of ctx.tasks) {
    lines.push(
      `- ${t.title} [status=${t.status}, priority=${t.priority}${t.estimateHours ? `, estimate=${t.estimateHours}h` : ''}${t.dueDate ? `, due=${t.dueDate.toISOString().slice(0, 10)}` : ''}${t.assignee ? `, assignee=${t.assignee.name}` : ''}]`,
    );
    for (const st of t.subtasks) lines.push(`  - ${st.title} [status=${st.status}]`);
  }
  lines.push('', `Write the documentation in ${language}.`);
  return lines.filter((line) => line !== undefined).join('\n');
}
