import { z } from 'zod';
import { env } from '../../config/env';
import { AppError, NotFoundError } from '../../shared/errors';
import type { Db } from '../../shared/db/prisma';
import type { ProjectRole } from '../projects';
import type {
  AiAssigneeSuggestion,
  EnrichedTask,
  EstimateSuggestion,
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
  estimateHours: z.number().positive().max(1000).nullish(),
});

const rawEstimateSchema = z.object({
  estimateHours: z.number().positive().max(1000).nullish(),
  points: z.number().int().min(0).max(200).nullish(),
  rationale: z.string().max(600).optional(),
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
   * subtask titles, assignee suggestions and an effort estimate. The client decides what
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

  /**
   * §2 smart estimate: few-shot from this team's own closed tasks (title+description →
   * actual hours), so the number is anchored to real experience. `basedOn` tells the
   * UI how honest to be ("based on 3 similar tasks").
   */
  async suggestEstimate(
    userId: number,
    projectId: number,
    input: { title: string; description?: string },
  ): Promise<EstimateSuggestion> {
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const [closed, requester] = await Promise.all([
      this.db.task.findMany({
        where: {
          projectId,
          deletedAt: null,
          status: 'DONE',
          estimateHours: { not: null },
        },
        select: { title: true, description: true, estimateHours: true, points: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
      this.db.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    ]);

    const content = await this.chat({
      json: true,
      messages: [
        { role: 'system', content: ESTIMATE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: renderEstimate(
            closed.map((t) => ({
              title: t.title,
              description: t.description ?? '',
              estimateHours: t.estimateHours ?? 0,
              points: t.points,
            })),
            input,
            languageOf(requester?.locale),
          ),
        },
      ],
    });

    let raw: unknown;
    try {
      raw = extractJson(content);
    } catch {
      throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI did not return valid JSON');
    }
    const parsed = rawEstimateSchema.safeParse(raw);
    if (!parsed.success) throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an unexpected shape');
    return {
      estimateHours: parsed.data.estimateHours ?? null,
      points: parsed.data.points ?? null,
      basedOn: closed.length,
      rationale: (parsed.data.rationale ?? '').trim(),
    };
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
        where: { projectId, deletedAt: null, assigneeId: userId, status: { not: 'DONE' } },
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

  private async chat(opts: ChatOptions): Promise<string> {
    if (!env.AI_API_KEY) throw notConfigured();
    const base: Record<string, unknown> = { model: env.AI_MODEL, messages: opts.messages, temperature: 0.3 };
    if (opts.json) base.response_format = { type: 'json_object' };

    let res = await this.request(base);
    // Some OpenAI-compatible providers reject response_format — retry once without it.
    if (res.status === 400 && opts.json) {
      const rest = { ...base };
      delete rest.response_format;
      res = await this.request(rest);
    }
    if (!res.ok) {
      throw new AppError(502, 'AI_PROVIDER_ERROR', `The AI provider responded with HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned an empty response');
    return content;
  }

  private async request(body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      return await (this.fetchImpl ?? globalThis.fetch)(`${env.AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY ?? ''}` },
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
      estimateHours: data.estimateHours ?? null,
    };
  }

  // ---- project context (the data the model is allowed to know) -----------------------------

  private async buildContext(projectId: number): Promise<EnrichContext> {
    const [project, members, workload, recentTasks] = await Promise.all([
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
      this.db.task.findMany({
        where: { projectId, deletedAt: null, parentId: null },
        select: { title: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

    const openByUser = new Map(workload.map((w) => [w.assigneeId, w._count._all]));
    return {
      project,
      recentTasks,
      members: members.map((m) => ({ ...m, openTasks: openByUser.get(m.userId) ?? 0 })),
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
  '- "estimateHours": total effort estimate in working hours (number) or null',
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

const ESTIMATE_SYSTEM_PROMPT = [
  'You are a senior estimator inside a project management API.',
  'Given a new task and a list of this team\'s recently completed tasks with their actual effort,',
  'respond with JSON: {"estimateHours": number|null, "points": number|null, "rationale": string}.',
  'Anchor the estimate on the similar completed tasks (title/description similarity) — extrapolate',
  'from real history, not generic guesses. If history is thin, say so in the rationale.',
  'Respond with JSON only.',
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

function renderEstimate(
  history: { title: string; description: string; estimateHours: number; points: number | null }[],
  input: { title: string; description?: string },
  language: string,
): string {
  return [
    `# Team's recently completed tasks (the calibration set)`,
    history.length > 0
      ? history
          .map((h) => `- "${h.title}" — estimate ${h.estimateHours}h${h.points ? `, ${h.points} points` : ''}${h.description ? `: ${h.description.slice(0, 150)}` : ''}`)
          .join('\n')
      : '(none — the estimate will be generic; say so in the rationale)',
    '',
    `# Task to estimate`,
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description}` : '',
    '',
    `Write the rationale in ${language}.`,
  ].join('\n');
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
