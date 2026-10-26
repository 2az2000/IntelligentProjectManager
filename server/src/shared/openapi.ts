import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { loginBody, registerBody } from '../modules/auth';
import {
  addMemberBody,
  createProjectBody,
  updateMemberBody,
  updateProjectBody,
} from '../modules/projects';
import { createTaskBody, listTasksQuery, moveTaskBody, updateTaskBody } from '../modules/tasks';
import { breakdownBody, enrichTaskBody } from '../modules/ai';
import { changePasswordBody, forgotPasswordBody, resetPasswordBody } from '../modules/auth';

/**
 * Phase 6: machine-readable API contract served at /docs (Swagger UI) and
 * /docs.json. Request schemas are the very same Zod objects the endpoints
 * validate with, so the docs cannot drift from the implementation. Mounted
 * only outside production (see app.ts).
 */
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'access_token',
  description: 'HttpOnly JWT access cookie set by /auth/login and /auth/register.',
});

// ---- schema helpers -------------------------------------------------------

const Id = z.number().int().positive();
const Role = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
const Status = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
      requestId: z.string().optional(),
    }),
  })
  .openapi('Error');

const UserSchema = z
  .object({
    id: Id,
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
    locale: z.string().optional(),
    theme: z.string().nullable().optional(),
    notifyEmail: z.boolean().optional(),
    /** §2.1 per-kind switches, already resolved with defaults (never partially null). */
    emailPreferences: z
      .object({ digest: z.boolean(), reminders: z.boolean(), weekly: z.boolean() })
      .optional(),
    /** §4 first-run tour stamp (null until finished or skipped). */
    onboardedAt: z.string().nullable().optional(),
  })
  .openapi('User');

const MemberSchema = z
  .object({
    userId: Id,
    role: Role,
    name: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable().optional(),
    skills: z.array(z.string()).optional(),
  })
  .openapi('Member');

/**
 * A user as the API returns them (task author, assignee, project owner), inlined rather than
 * registered as a component on purpose: a `$ref` next to `nullable` is emitted as `<ref> & unknown`,
 * which would stop the generated type from being *exactly* the shared `UserSummary` the client
 * codes against (see client/src/lib/api-contract.ts).
 */
const userSummary = () => z.object({ id: Id, name: z.string(), avatarUrl: z.string().nullable() });

const ProjectStatsSchema = z
  .object({
    total: z.number().int(),
    done: z.number().int(),
    overdue: z.number().int(),
    /** §3 per-parent subtask progress (done/total) for parent cards. */
    subtaskProgress: z.array(z.object({ taskId: Id, done: z.number().int(), total: z.number().int() })),
  })
  .openapi('ProjectStats');

/** Mirrors ProjectDto in `@managesys/contracts` (the client type-checks both against each other). */
const ProjectSchema = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    ownerId: Id,
    owner: userSummary(),
    myRole: Role,
    memberCount: z.number().int(),
    /** §4 WIP limits per board column (`{ IN_PROGRESS: 5 }`); null = unlimited. */
    columnLimits: z.record(z.string(), z.number()).nullable(),
    stats: ProjectStatsSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Project');

const TaskDateConflictSchema = z
  .object({
    code: z.literal('DEPENDENCY_DATE_CONFLICT'),
    direction: z.enum(['predecessor', 'successor']),
    relatedTaskId: Id,
    relatedTaskTitle: z.string(),
    conflictDays: z.number().int(),
  })
  .openapi('TaskDateConflict');

/** Mirrors TaskDto in `@managesys/contracts` (the client type-checks both against each other). */
const TaskSchema = z
  .object({
    id: Id,
    projectId: Id,
    project: z.object({ id: Id, name: z.string() }),
    parentId: Id.nullable(),
    title: z.string(),
    description: z.string().nullable(),
    /** §4 sanitized rich text body; `description` is its plain-text twin. */
    descriptionHtml: z.string().nullable(),
    /** Analytics bucket of `statusKey`. */
    status: Status,
    /** Workflow column the task sits in (`ProjectStatus.key` of the same project). */
    statusKey: z.string(),
    priority: Priority,
    position: z.number(),
    tags: z.array(z.string()),
    points: z.number().nullable(),
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    estimateHours: z.number().nullable(),
    completedAt: z.string().nullable(),
    author: userSummary(),
    /** Lead assignee; null when nobody owns the task. */
    assignee: userSummary().nullable(),
    /** Whole assignee set: lead first, then co-assignees (`assigneeIds` on writes). */
    assignees: z.array(userSummary()),
    subtaskCount: z.number().int(),
    doneSubtaskCount: z.number().int(),
    commentCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    /** Only on a PATCH response: date edits that clash with the dependency chain. */
    warnings: z.array(TaskDateConflictSchema).optional(),
  })
  .openapi('Task');

const CommentReactionSchema = z
  .object({
    emoji: z.string(),
    users: z.array(z.object({ id: Id, name: z.string(), avatarUrl: z.string().nullable() })),
  })
  .openapi('CommentReaction');

const CommentSchema = z
  .object({
    id: Id,
    taskId: Id,
    authorId: Id,
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    edited: z.boolean(),
    /** Pre-grouped by emoji, in the server's fixed order. */
    reactions: z.array(CommentReactionSchema),
  })
  .openapi('Comment');

const AttachmentSchema = z
  .object({
    id: Id,
    taskId: Id,
    fileName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    createdAt: z.string(),
  })
  .openapi('Attachment');

/**
 * One row of a task's audit trail. A row is a single tracked-field change: `field` is null for
 * lifecycle events (created/moved/deleted) and one of the task's tracked fields otherwise.
 */
const ActivityEntrySchema = z
  .object({
    id: Id,
    taskId: Id,
    action: z.enum(['created', 'updated', 'moved', 'deleted']),
    field: z.string().nullable(),
    oldValue: z.string().nullable(),
    newValue: z.string().nullable(),
    actor: z.object({ id: Id, name: z.string(), avatarUrl: z.string().nullable() }),
    createdAt: z.string().datetime(),
  })
  .openapi('ActivityEntry');

/** One cursor page of the audit trail; totals cover the whole task history. */
const ActivityPageSchema = z
  .object({
    items: z.array(ActivityEntrySchema),
    nextCursor: Id.nullable(),
    total: z.number().int(),
    people: z.number().int(),
  })
  .openapi('ActivityPage');

const NotificationSchema = z
  .object({
    id: Id,
    type: z.enum(['ASSIGNED', 'MENTIONED', 'COMMENTED', 'DUE_REMINDER', 'DAILY_DIGEST', 'WEEKLY_SUMMARY']),
    actorId: Id.nullable().optional(),
    taskId: Id.nullable().optional(),
    projectId: Id.nullable().optional(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('Notification');

const DependencySchema = z
  .object({
    predecessorId: Id,
    successorId: Id,
    type: z.enum(['FINISH_TO_START']),
  })
  .openapi('Dependency');

const AiAssigneeSchema = z
  .object({ userId: Id, name: z.string(), reason: z.string() })
  .openapi('AiAssignee');

const AiEnrichmentSchema = z
  .object({
    description: z.string(),
    subtasks: z.array(z.string()),
    suggestedAssignees: z.array(AiAssigneeSchema),
  })
  .openapi('AiEnrichment');

const AiProjectDocSchema = z
  .object({ markdown: z.string(), model: z.string() })
  .openapi('AiProjectDoc');

const AiBreakdownTaskSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    priority: Priority,
    estimateHours: z.number().nullable(),
    tags: z.array(z.string()),
    /** Indexes into the same array (always < the task's own index). */
    dependsOn: z.array(z.number().int()),
    assigneeId: Id.nullable(),
  })
  .openapi('AiBreakdownTask');

const AiBreakdownSchema = z
  .object({ tasks: z.array(AiBreakdownTaskSchema), model: z.string() })
  .openapi('AiBreakdown');

const AiChatSchema = z
  .object({ answer: z.string(), model: z.string() })
  .openapi('AiChat');

const AiWeeklySummarySchema = z
  .object({
    markdown: z.string(),
    model: z.string(),
    range: z.object({ from: z.string(), to: z.string() }),
    stats: z.object({
      completed: z.number().int(),
      created: z.number().int(),
      open: z.number().int(),
      overdue: z.number().int(),
      blocked: z.number().int(),
      activity: z.number().int(),
      activeMembers: z.number().int(),
    }),
  })
  .openapi('AiWeeklySummary');

const DeadlinePlanSchema = z
  .object({
    deadline: z.string(),
    anchor: z.string(),
    confidence: z.union([z.literal(50), z.literal(85), z.literal(95)]),
    feasible: z.boolean(),
    availableHours: z.number(),
    requiredHours: z.number(),
    projectDurationHours: z.number(),
    bufferHours: z.number(),
    bufferWorkingDays: z.number(),
    mustStartNow: z.array(Id),
    unestimatedTaskIds: z.array(Id),
    tasks: z.array(
      z.object({
        taskId: Id,
        title: z.string(),
        status: z.string(),
        estimateHours: z.number().nullable(),
        latestStart: z.string().nullable(),
        latestFinish: z.string().nullable(),
        slackHours: z.number().nullable(),
        isCritical: z.boolean(),
        mustStartNow: z.boolean(),
      }),
    ),
  })
  .openapi('DeadlinePlan');

const SearchResultsSchema = z
  .object({
    tasks: z.array(
      z.object({
        id: Id,
        projectId: Id,
        projectTitle: z.string(),
        title: z.string(),
        status: z.string(),
        match: z.enum(['keyword', 'semantic']),
        similarity: z.number().optional(),
      }),
    ),
    projects: z.array(z.object({ id: Id, title: z.string() })),
    comments: z.array(
      z.object({ id: Id, taskId: Id, projectId: Id, taskTitle: z.string(), snippet: z.string() }),
    ),
    semantic: z.object({
      requested: z.boolean(),
      available: z.boolean(),
      used: z.boolean(),
      reason: z.enum(['not_configured', 'provider_error']).optional(),
    }),
  })
  .openapi('SearchResults');

const pathId = (name: string) =>
  z.coerce
    .number()
    .int()
    .positive()
    .openapi({ param: { name, in: 'path', required: true } });

const json = (schema: z.ZodTypeAny) => ({ 'application/json': { schema } });
const ok = (schema?: z.ZodTypeAny): RouteConfig['responses'][string] => ({
  description: 'Successful response',
  ...(schema ? { content: json(schema) } : {}),
});
const created = (schema: z.ZodTypeAny) => ({ description: 'Created', content: json(schema) });
const noContent = () => ({ description: 'No content' });
const error = ok(ErrorSchema);
const auth = [{ cookieAuth: [] }];

function register(route: RouteConfig): void {
  registry.registerPath(route);
}

// ---- health & auth --------------------------------------------------------

register({
  method: 'get',
  path: '/health',
  summary: 'Liveness + database check',
  tags: ['Health'],
  responses: {
    200: ok(z.object({ status: z.literal('ok'), db: z.literal('ok') })),
    503: ok(z.object({ status: z.literal('degraded'), db: z.literal('error') })),
  },
});

register({
  method: 'post',
  path: '/auth/register',
  summary: 'Create an account (sets auth cookies)',
  tags: ['Auth'],
  request: { body: { content: json(registerBody), required: true } },
  responses: { 201: created(UserSchema), 400: error, 409: error },
});

register({
  method: 'post',
  path: '/auth/login',
  summary: 'Log in (sets auth cookies)',
  tags: ['Auth'],
  request: { body: { content: json(loginBody), required: true } },
  responses: { 200: ok(UserSchema), 400: error, 401: error },
});

register({
  method: 'post',
  path: '/auth/refresh',
  summary: 'Rotate the refresh token (single-use) and re-issue the access cookie',
  tags: ['Auth'],
  responses: { 204: noContent(), 401: error },
});

register({
  method: 'post',
  path: '/auth/logout',
  summary: 'Revoke the session and clear cookies',
  tags: ['Auth'],
  responses: { 204: noContent() },
});

register({
  method: 'post',
  path: '/auth/forgot-password',
  summary: 'Request a password reset email (always 204 — never reveals if the email exists)',
  tags: ['Auth'],
  request: { body: { content: json(forgotPasswordBody), required: true } },
  responses: { 204: noContent(), 400: error, 429: error },
});

register({
  method: 'post',
  path: '/auth/reset-password',
  summary: 'Set a new password with a reset token (signs out every session)',
  tags: ['Auth'],
  request: { body: { content: json(resetPasswordBody), required: true } },
  responses: { 204: noContent(), 400: error, 429: error },
});

register({
  method: 'post',
  path: '/auth/change-password',
  summary: 'Change my password (requires the current one; keeps this session)',
  tags: ['Auth'],
  security: auth,
  request: { body: { content: json(changePasswordBody), required: true } },
  responses: { 204: noContent(), 400: error, 401: error },
});

register({
  method: 'get',
  path: '/auth/me',
  summary: 'Current session user',
  tags: ['Auth'],
  security: auth,
  responses: { 200: ok(UserSchema), 401: error },
});

// ---- users ----------------------------------------------------------------

register({
  method: 'get',
  path: '/users',
  summary: 'Search users (invite picker)',
  tags: ['Users'],
  security: auth,
  request: {
    query: z.object({
      search: z
        .string()
        .min(2)
        .openapi({ param: { name: 'search', in: 'query', required: true } }),
    }),
  },
  responses: { 200: ok(z.array(UserSchema)), 401: error },
});

register({
  method: 'patch',
  path: '/users/me',
  summary: 'Update my profile (name, avatar, locale, theme, notifyEmail, emailPreferences)',
  tags: ['Users'],
  security: auth,
  request: {
    body: {
      content: json(
        z
          .object({
            name: z.string().min(1).max(80),
            avatarUrl: z.string().url().nullable(),
            locale: z.string(),
            theme: z.string().nullable(),
            notifyEmail: z.boolean(),
            /** §2.1: only the kinds sent are changed; omitted ones keep their stored value. */
            emailPreferences: z
              .object({ digest: z.boolean(), reminders: z.boolean(), weekly: z.boolean() })
              .partial(),
            /** §4 onboarding stamp (ISO date, or null to replay the tour). */
            onboardedAt: z.string().datetime().nullable(),
          })
          .partial(),
      ),
      required: true,
    },
  },
  responses: { 200: ok(UserSchema), 400: error, 401: error },
});

// ---- avatars (public) ------------------

register({
  method: 'get',
  path: '/avatars/{fileName}',
  summary: 'Serve an uploaded avatar (public, server-minted UUID names only)',
  tags: ['Users'],
  request: {
    params: z.object({
      fileName: z.string().openapi({ param: { name: 'fileName', in: 'path', required: true } }),
    }),
  },
  responses: {
    200: {
      description: 'Image stream',
      content: { 'image/png': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    404: error,
  },
});

// ---- digest (dashboard) ------------------------------------------------

/**
 * The daily report behind the DAILY_DIGEST notification. `dueToday`/`overdue`/`open` are the
 * stat tiles, `tasks` the due-today-and-late list (each row knows how late it is), and
 * `perProject`/`completedSinceYesterday`/`inProgress` the context that makes it a report
 * rather than a bare count.
 */
const DigestSchema = z
  .object({
    generatedAt: z.string().datetime(),
    open: z.number().int().min(0),
    overdue: z.number().int().min(0),
    dueToday: z.number().int().min(0),
    dueThisWeek: z.number().int().min(0),
    completedSinceYesterday: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    /** Age of the oldest overdue task in whole days; 0 when nothing is overdue. */
    overdueByDays: z.number().int().min(0),
    tasks: z.array(
      z.object({
        id: Id,
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        dueDate: z.string().datetime().nullable(),
        projectId: Id,
        projectName: z.string(),
        overdue: z.boolean(),
        overdueByDays: z.number().int().min(0),
        daysUntilDue: z.number().int().nullable(),
      }),
    ),
    perProject: z.array(
      z.object({
        projectId: Id,
        projectName: z.string(),
        open: z.number().int().min(0),
        overdue: z.number().int().min(0),
      }),
    ),
  })
  .openapi('Digest');

const SummarySchema = z
  .object({
    projectCount: z.number().int().min(0),
    myOpenTasks: z.number().int().min(0),
    overdue: z.number().int().min(0),
    dueThisWeek: z.number().int().min(0),
    completedThisWeek: z.number().int().min(0),
    byStatus: z.record(z.string(), z.number().int().min(0)),
    upcoming: z.array(
      z.object({
        id: Id,
        title: z.string(),
        dueDate: z.string().datetime().nullable(),
        priority: z.string(),
        status: z.string(),
        projectId: Id,
        projectName: z.string(),
      }),
    ),
    recentProjects: z.array(
      z.object({ id: Id, name: z.string(), updatedAt: z.string().datetime() }),
    ),
  })
  .openapi('DashboardSummary');

// ---- projects -------------------------------------------------------------

register({
  method: 'get',
  path: '/projects',
  summary: 'Projects I am a member of',
  tags: ['Projects'],
  security: auth,
  responses: { 200: ok(z.array(ProjectSchema)), 401: error },
});

register({
  method: 'post',
  path: '/projects',
  summary: 'Create a project (I become OWNER)',
  tags: ['Projects'],
  security: auth,
  request: { body: { content: json(createProjectBody), required: true } },
  responses: { 201: created(ProjectSchema), 400: error, 401: error },
});

register({
  method: 'get',
  path: '/projects/{projectId}',
  summary: 'Project details with stats',
  tags: ['Projects'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(ProjectSchema), 404: error },
});

register({
  method: 'patch',
  path: '/projects/{projectId}',
  summary: 'Update project (ADMIN+)',
  tags: ['Projects'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(updateProjectBody), required: true },
  },
  responses: { 200: ok(ProjectSchema), 400: error, 403: error, 404: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}',
  summary: 'Delete a project (OWNER only)',
  tags: ['Projects'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 204: noContent(), 403: error, 404: error },
});

register({
  method: 'get',
  path: '/projects/{projectId}/members',
  summary: 'List project members',
  tags: ['Projects'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(MemberSchema)), 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/members',
  summary: 'Add a member (ADMIN+)',
  tags: ['Projects'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(addMemberBody), required: true },
  },
  responses: { 201: created(MemberSchema), 400: error, 403: error, 404: error },
});

register({
  method: 'patch',
  path: '/projects/{projectId}/members/{userId}',
  summary: 'Change member role',
  tags: ['Projects'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId'), userId: pathId('userId') }),
    body: { content: json(updateMemberBody), required: true },
  },
  responses: { 200: ok(MemberSchema), 403: error, 404: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}/members/{userId}',
  summary: 'Remove a member (assignments are unassigned)',
  tags: ['Projects'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId'), userId: pathId('userId') }) },
  responses: { 204: noContent(), 403: error, 404: error },
});

// ---- tasks ----------------------------------------------------------------

const taskParams = z.object({ taskId: pathId('taskId') });

register({
  method: 'get',
  path: '/projects/{projectId}/tasks',
  summary: 'List project tasks (filters optional)',
  tags: ['Tasks'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }), query: listTasksQuery },
  responses: { 200: ok(z.array(TaskSchema)), 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/tasks',
  summary: 'Create a task in a project',
  tags: ['Tasks'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(createTaskBody), required: true },
  },
  responses: { 201: created(TaskSchema), 400: error, 404: error },
});

register({
  method: 'get',
  path: '/tasks/{taskId}',
  summary: 'Task details',
  tags: ['Tasks'],
  security: auth,
  request: { params: taskParams },
  responses: { 200: ok(TaskSchema), 404: error },
});

register({
  method: 'patch',
  path: '/tasks/{taskId}',
  summary: 'Partial task update (fires activity + realtime + notifications)',
  tags: ['Tasks'],
  security: auth,
  request: { params: taskParams, body: { content: json(updateTaskBody), required: true } },
  responses: { 200: ok(TaskSchema), 400: error, 404: error },
});

register({
  method: 'delete',
  path: '/tasks/{taskId}',
  summary: 'Soft-delete a task',
  tags: ['Tasks'],
  security: auth,
  request: { params: taskParams },
  responses: { 204: noContent(), 404: error },
});

register({
  method: 'post',
  path: '/tasks/{taskId}/move',
  summary: 'Move a task between statuses with fractional ordering',
  tags: ['Tasks'],
  security: auth,
  request: { params: taskParams, body: { content: json(moveTaskBody), required: true } },
  responses: { 200: ok(TaskSchema), 400: error, 404: error },
});

// ---- comments -------------------------------------------------------------

const commentBody = z.object({ body: z.string().trim().min(1).max(5000) });

register({
  method: 'get',
  path: '/tasks/{taskId}/comments',
  summary: 'List task comments',
  tags: ['Comments'],
  security: auth,
  request: { params: taskParams },
  responses: { 200: ok(z.array(CommentSchema)), 404: error },
});

register({
  method: 'post',
  path: '/tasks/{taskId}/comments',
  summary: 'Comment on a task (@Name mentions notify members)',
  tags: ['Comments'],
  security: auth,
  request: { params: taskParams, body: { content: json(commentBody), required: true } },
  responses: { 201: created(CommentSchema), 400: error, 404: error },
});

register({
  method: 'delete',
  path: '/comments/{commentId}',
  summary: 'Delete own comment (or ADMIN+)',
  tags: ['Comments'],
  security: auth,
  request: { params: z.object({ commentId: pathId('commentId') }) },
  responses: { 204: noContent(), 403: error, 404: error },
});

register({
  method: 'post',
  path: '/comments/{commentId}/reactions',
  summary: 'Toggle an emoji reaction on a comment (same emoji again removes it)',
  tags: ['Comments'],
  security: auth,
  request: {
    params: z.object({ commentId: pathId('commentId') }),
    body: {
      content: json(z.object({ emoji: z.enum(['👍', '❤️', '🎉', '🚀', '👀', '😄']) })),
      required: true,
    },
  },
  responses: {
    200: ok(z.object({ commentId: Id, reactions: z.array(CommentReactionSchema) })),
    400: error,
    404: error,
  },
});

// ---- scheduling (phase 4) -------------------------------------------------

const dependencyBody = z
  .object({ predecessorId: Id, successorId: Id })
  .openapi('CreateDependencyBody');

register({
  method: 'get',
  path: '/projects/{projectId}/dependencies',
  summary: 'List task dependencies',
  tags: ['Scheduling'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(DependencySchema)), 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/dependencies',
  summary: 'Link two tasks (409 on cycle / duplicate)',
  tags: ['Scheduling'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(dependencyBody), required: true },
  },
  responses: { 201: created(DependencySchema), 400: error, 409: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}/dependencies/{predecessorId}/{successorId}',
  summary: 'Unlink two tasks',
  tags: ['Scheduling'],
  security: auth,
  request: {
    params: z.object({
      projectId: pathId('projectId'),
      predecessorId: pathId('predecessorId'),
      successorId: pathId('successorId'),
    }),
  },
  responses: { 204: noContent(), 404: error },
});

register({
  method: 'get',
  path: '/projects/{projectId}/schedule',
  summary: 'CPM schedule (critical path, slack, unestimated tasks)',
  tags: ['Scheduling'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.record(z.string(), z.unknown())), 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/schedule/apply',
  summary: 'Write scheduled dates onto tasks (MEMBER+)',
  tags: ['Scheduling'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.record(z.string(), z.unknown())), 403: error, 404: error },
});

register({
  method: 'get',
  path: '/tasks/{taskId}/schedule',
  summary: 'Schedule for a single task',
  tags: ['Scheduling'],
  security: auth,
  request: { params: taskParams },
  responses: { 200: ok(z.record(z.string(), z.unknown())), 404: error },
});

// ---- §2.2 baselines --------------------------------------------------------

const BaselineSchema = z
  .object({
    id: Id,
    projectId: Id,
    name: z.string(),
    createdAt: z.string(),
    createdBy: z.object({ id: Id, name: z.string(), avatarUrl: z.string().nullable() }),
    taskCount: z.number().int(),
    projectDurationHours: z.number(),
  })
  .openapi('Baseline');

const BaselineChangeSchema = z
  .object({
    taskId: Id,
    title: z.string(),
    action: z.enum(['added', 'removed', 'moved', 'onTrack']),
    /** CPM positions in working hours; null when a side has no estimate. */
    baselineStartHours: z.number().nullable(),
    baselineFinishHours: z.number().nullable(),
    currentStartHours: z.number().nullable(),
    currentFinishHours: z.number().nullable(),
    /** current − baseline; positive = the task starts later than planned. */
    driftHours: z.number().nullable(),
  })
  .openapi('BaselineChange');

const BaselineVarianceSchema = z
  .object({
    baseline: BaselineSchema,
    currentDurationHours: z.number(),
    durationDriftHours: z.number(),
    counts: z.object({
      added: z.number().int(),
      removed: z.number().int(),
      moved: z.number().int(),
      onTrack: z.number().int(),
    }),
    totalDriftHours: z.number(),
    tasks: z.array(BaselineChangeSchema),
  })
  .openapi('BaselineVariance');

register({
  method: 'get',
  path: '/projects/{projectId}/baselines',
  summary: 'Captured plans of this project, newest first',
  tags: ['Scheduling'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(BaselineSchema)), 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/baselines',
  summary: 'Snapshot the current CPM plan (MEMBER+)',
  tags: ['Scheduling'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: {
      content: json(z.object({ name: z.string().min(1).max(80) }).partial()),
      required: true,
    },
  },
  responses: { 201: created(BaselineSchema), 400: error, 403: error, 409: error },
});

register({
  method: 'get',
  path: '/projects/{projectId}/baselines/{baselineId}/variance',
  summary: 'Per-task drift between a baseline and the schedule computed now',
  tags: ['Scheduling'],
  security: auth,
  request: {
    params: z.object({
      projectId: pathId('projectId'),
      baselineId: pathId('baselineId'),
    }),
  },
  responses: { 200: ok(BaselineVarianceSchema), 404: error },
});

// ---- attachments (phase 4) ------------------------------------------------

register({
  method: 'get',
  path: '/tasks/{taskId}/attachments',
  summary: 'List task attachments',
  tags: ['Attachments'],
  security: auth,
  request: { params: taskParams },
  responses: { 200: ok(z.array(AttachmentSchema)), 404: error },
});

register({
  method: 'post',
  path: '/tasks/{taskId}/attachments',
  summary: 'Upload a file (multipart/form-data field "file", max MAX_UPLOAD_MB)',
  tags: ['Attachments'],
  security: auth,
  request: {
    params: taskParams,
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().openapi({ format: 'binary' }) }),
        },
      },
    },
  },
  responses: { 201: created(AttachmentSchema), 400: error, 413: error, 404: error },
});

register({
  method: 'get',
  path: '/attachments/{attachmentId}/download',
  summary: 'Stream the stored file',
  tags: ['Attachments'],
  security: auth,
  request: { params: z.object({ attachmentId: pathId('attachmentId') }) },
  responses: {
    200: {
      description: 'File stream',
      content: { 'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    404: error,
  },
});

register({
  method: 'delete',
  path: '/attachments/{attachmentId}',
  summary: 'Delete an attachment (uploader or ADMIN-OWNER)',
  tags: ['Attachments'],
  security: auth,
  request: { params: z.object({ attachmentId: pathId('attachmentId') }) },
  responses: { 204: noContent(), 403: error, 404: error },
});

// ---- activity (phase 5) ---------------------------------------------------

register({
  method: 'get',
  path: '/tasks/{taskId}/activity',
  summary: 'Audit trail of a task, paginated newest first (default page size 8)',
  tags: ['Activity'],
  security: auth,
  request: {
    params: taskParams,
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).optional(),
      cursor: z.coerce.number().int().positive().optional(),
    }),
  },
  responses: { 200: ok(ActivityPageSchema), 400: error, 404: error },
});

// ---- notifications (phase 5) ----------------------------------------------

register({
  method: 'get',
  path: '/notifications',
  summary: 'My notifications (newest first)',
  tags: ['Notifications'],
  security: auth,
  responses: { 200: ok(z.array(NotificationSchema)), 401: error },
});

register({
  method: 'get',
  path: '/notifications/unread-count',
  summary: 'Unread badge count',
  tags: ['Notifications'],
  security: auth,
  responses: { 200: ok(z.object({ count: z.number() })), 401: error },
});

register({
  method: 'post',
  path: '/notifications/{notificationId}/read',
  summary: 'Mark one notification as read',
  tags: ['Notifications'],
  security: auth,
  request: { params: z.object({ notificationId: pathId('notificationId') }) },
  responses: { 204: noContent(), 404: error },
});

register({
  method: 'post',
  path: '/notifications/read-all',
  summary: 'Mark every notification as read',
  tags: ['Notifications'],
  security: auth,
  responses: { 204: noContent(), 401: error },
});

// ---- dashboard -------------------------------------------------------------

register({
  method: 'get',
  path: '/dashboard/summary',
  summary: 'Dashboard cards: stats, chart, upcoming and recent projects',
  tags: ['Dashboard'],
  security: auth,
  responses: { 200: ok(SummarySchema), 401: error },
});

register({
  method: 'get',
  path: '/dashboard/digest',
  summary: 'Daily digest report (the tasks behind the DAILY_DIGEST notification)',
  tags: ['Dashboard'],
  security: auth,
  responses: { 200: ok(DigestSchema), 401: error },
});

// ---- Team / workload (§Imp #4) --------------------------------------------

const TeamWorkloadSchema = z.object({
  capacityHoursPerWeek: z.number().int().positive(),
  weeks: z.array(z.object({ start: z.string(), end: z.string() })),
  members: z.array(
    z.object({
      user: UserSchema,
      capacityHoursPerWeek: z.number().int().positive().nullable(),
      cells: z.array(
        z.object({
          hours: z.number(),
          tasks: z.array(
            z.object({
              id: Id,
              title: z.string(),
              projectId: Id,
              projectName: z.string(),
              estimateHours: z.number().nullable(),
              dueDate: z.string().nullable(),
            }),
          ),
        }),
      ),
    }),
  ),
});

register({
  method: 'get',
  path: '/me/team/workload',
  summary: 'Open workload per member × week (hours summed over estimate shares), for the Members heatmap and the Timeline over-allocation badge',
  tags: ['Team'],
  security: auth,
  request: {
    query: z.object({ weeks: z.coerce.number().int().min(1).max(26).default(8) }),
  },
  responses: { 200: ok(TeamWorkloadSchema), 401: error },
});

register({
  method: 'get',
  path: '/projects/{projectId}/plan',
  summary: 'Deadline planner: latest start for every task at P50/P85/P95, and what must start now',
  tags: ['Scheduling'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    query: z.object({
      by: z.coerce.date().optional(),
      confidence: z.coerce.number().optional(),
    }),
  },
  responses: { 200: ok(DeadlinePlanSchema), 400: error, 403: error, 404: error },
});

// ---- AI (phase 7) ---------------------------------------------------------

register({
  method: 'post',
  path: '/projects/{projectId}/ai/enrich-task',
  summary: 'AI preview: complete a rough task (description, subtasks, assignees) — writes nothing',
  tags: ['AI'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(enrichTaskBody), required: true },
  },
  responses: {
    200: ok(AiEnrichmentSchema),
    400: error,
    403: error,
    404: error,
    429: error,
    502: error,
    503: error,
    504: error,
  },
});

register({
  method: 'post',
  path: '/projects/{projectId}/ai/project-doc',
  summary: 'AI preview: generate full project documentation as Markdown — writes nothing',
  tags: ['AI'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: {
    200: ok(AiProjectDocSchema),
    400: error,
    403: error,
    404: error,
    429: error,
    502: error,
    503: error,
    504: error,
  },
});

register({
  method: 'post',
  path: '/projects/{projectId}/ai/breakdown',
  summary: 'AI: turn a PRD/brief into a previewed task list with estimates and dependencies — writes nothing',
  tags: ['AI'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(breakdownBody), required: true },
  },
  responses: { 200: ok(AiBreakdownSchema), 400: error, 403: error, 404: error, 429: error, 502: error, 503: error, 504: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/ai/chat',
  summary: 'AI: read-only chat about the project, scoped by the asking user’s role (VIEWER+)',
  tags: ['AI'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: {
      content: json(
        z.object({
          messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
        }),
      ),
      required: true,
    },
  },
  responses: { 200: ok(AiChatSchema), 400: error, 403: error, 404: error, 429: error, 502: error, 503: error, 504: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/ai/weekly-summary',
  summary: 'AI: weekly project report from the last 7 days of activity (VIEWER+); the Monday job mails the same report',
  tags: ['AI'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(AiWeeklySummarySchema), 403: error, 404: error, 429: error, 502: error, 503: error, 504: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/ai/embeddings/backfill',
  summary: 'Embed up to 200 existing tasks for semantic search (MEMBER+)',
  tags: ['AI'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: {
    200: ok(z.object({ embedded: z.number().int(), failed: z.number().int(), total: z.number().int() })),
    403: error,
    404: error,
    429: error,
    503: error,
  },
});

// ---- search (lexical + pgvector) -------------------------------------------

register({
  method: 'get',
  path: '/search',
  summary: 'Global search across the caller’s projects (ILIKE + optional pgvector semantic pass)',
  tags: ['Search'],
  security: auth,
  request: {
    query: z.object({
      q: z.string().min(2).max(120),
      semantic: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: { 200: ok(SearchResultsSchema), 401: error },
});

register({
  method: 'get',
  path: '/search/status',
  summary: 'Whether semantic search can run (an embedding provider is configured)',
  tags: ['Search'],
  security: auth,
  responses: {
    200: ok(z.object({ semantic: z.object({ available: z.boolean(), model: z.string() }) })),
    401: error,
  },
});

// ---- labels (structured project vocabulary) ---------------------------------

const LabelSchema = z
  .object({
    id: Id,
    name: z.string(),
    /** `#rrggbb`, lower-case. */
    color: z.string(),
    /** Key from the client's shared icon set. */
    icon: z.string(),
  })
  .openapi('Label');

const labelBody = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    icon: z.string(),
  })
  .strict();

register({
  method: 'get',
  path: '/projects/{projectId}/labels',
  summary: "A project's label vocabulary (alphabetical)",
  tags: ['Labels'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(LabelSchema)), 401: error, 403: error, 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/labels',
  summary: 'Add a label to the vocabulary (ADMIN+)',
  tags: ['Labels'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(labelBody), required: true },
  },
  responses: { 201: ok(LabelSchema), 400: error, 403: error, 404: error, 409: error },
});

register({
  method: 'patch',
  path: '/projects/{projectId}/labels/{labelId}',
  summary: 'Rename/recolour a label (ADMIN+); a rename rewrites the matching tag on project tasks',
  tags: ['Labels'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId'), labelId: pathId('labelId') }),
    body: { content: json(labelBody.partial()), required: true },
  },
  responses: { 200: ok(LabelSchema), 400: error, 403: error, 404: error, 409: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}/labels/{labelId}',
  summary: 'Remove a label from the vocabulary (ADMIN+); task tags are left untouched',
  tags: ['Labels'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId'), labelId: pathId('labelId') }) },
  responses: { 204: { description: 'Removed' }, 403: error, 404: error },
});

// ---- saved views (§4) -------------------------------------------------------

const SavedViewFiltersSchema = z
  .object({
    search: z.string().optional(),
    priority: Priority.optional(),
    /** `0` means "unassigned", as in the board filters. */
    assigneeId: z.number().int().min(0).optional(),
    groupBy: z.enum(['none', 'assignee', 'priority', 'status']).optional(),
  })
  .openapi('SavedViewFilters');

const SavedViewSchema = z
  .object({
    id: Id,
    projectId: Id,
    name: z.string(),
    filters: SavedViewFiltersSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('SavedView');

const savedViewParams = z.object({ projectId: pathId('projectId'), viewId: pathId('viewId') });
const savedViewBody = z.object({ name: z.string().min(1).max(40), filters: SavedViewFiltersSchema });

register({
  method: 'get',
  path: '/projects/{projectId}/views',
  summary: 'My saved views of this project (VIEWER+)',
  tags: ['Tasks'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(SavedViewSchema)), 401: error, 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/views',
  summary: 'Save the current filters as a named view (VIEWER+; unique name per user)',
  tags: ['Tasks'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(savedViewBody), required: true },
  },
  responses: { 201: ok(SavedViewSchema), 400: error, 401: error, 404: error, 409: error },
});

register({
  method: 'patch',
  path: '/projects/{projectId}/views/{viewId}',
  summary: 'Rename a view or replace its filters (owner only)',
  tags: ['Tasks'],
  security: auth,
  request: {
    params: savedViewParams,
    body: { content: json(savedViewBody.partial()), required: true },
  },
  responses: { 200: ok(SavedViewSchema), 400: error, 401: error, 404: error, 409: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}/views/{viewId}',
  summary: 'Delete a saved view (owner only)',
  tags: ['Tasks'],
  security: auth,
  request: { params: savedViewParams },
  responses: { 204: { description: 'Deleted' }, 401: error, 404: error },
});

// ---- statuses (per-project workflow columns) -------------------------------

const StatusCategorySchema = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);

const ProjectStatusSchema = z
  .object({
    id: Id,
    /** ASCII slug stored on tasks; immutable after creation. */
    key: z.string(),
    /** Fallback display name for statuses without a client translation. */
    label: z.string(),
    /** `#rrggbb`, lower-case. */
    color: z.string(),
    category: StatusCategorySchema,
    position: z.number(),
  })
  .openapi('ProjectStatus');

const statusColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());

const createStatusBody = z
  .object({
    label: z.string().trim().min(1).max(40),
    color: statusColor,
    category: StatusCategorySchema,
    /** Insert directly after this column instead of appending at the end. */
    afterKey: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const patchStatusBody = z
  .object({
    label: z.string().trim().min(1).max(40).optional(),
    color: statusColor.optional(),
    category: StatusCategorySchema.optional(),
  })
  .strict();

register({
  method: 'get',
  path: '/projects/{projectId}/statuses',
  summary: "A project's workflow columns in board order",
  tags: ['Statuses'],
  security: auth,
  request: { params: z.object({ projectId: pathId('projectId') }) },
  responses: { 200: ok(z.array(ProjectStatusSchema)), 401: error, 403: error, 404: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/statuses',
  summary: 'Add a workflow column (ADMIN+); `afterKey` places it, otherwise it is appended',
  tags: ['Statuses'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(createStatusBody), required: true },
  },
  responses: { 201: ok(ProjectStatusSchema), 400: error, 403: error, 404: error, 409: error },
});

register({
  method: 'post',
  path: '/projects/{projectId}/statuses/reorder',
  summary: 'Rewrite the column order (ADMIN+); body must list every status key exactly once',
  tags: ['Statuses'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId') }),
    body: { content: json(z.object({ keys: z.array(z.string()).min(1) }).strict()), required: true },
  },
  responses: { 200: ok(z.array(ProjectStatusSchema)), 400: error, 403: error, 404: error },
});

register({
  method: 'patch',
  path: '/projects/{projectId}/statuses/{statusId}',
  summary: 'Rename/recolour/re-bucket a column (ADMIN+); a category change re-buckets its tasks',
  tags: ['Statuses'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId'), statusId: pathId('statusId') }),
    body: { content: json(patchStatusBody), required: true },
  },
  responses: { 200: ok(ProjectStatusSchema), 400: error, 403: error, 404: error },
});

register({
  method: 'delete',
  path: '/projects/{projectId}/statuses/{statusId}',
  summary: 'Delete a column (ADMIN+); a column holding tasks needs ?moveToKey= for them',
  tags: ['Statuses'],
  security: auth,
  request: {
    params: z.object({ projectId: pathId('projectId'), statusId: pathId('statusId') }),
    query: z.object({ moveToKey: z.string().optional() }),
  },
  responses: { 204: { description: 'Deleted' }, 400: error, 403: error, 404: error, 409: error },
});

// ---- document --------------------------------------------------------------

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openapiDocument = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'ManageSys API',
    version: '1.0.0',
    description:
      'Project management API (monorepo server). Auth is cookie-based: log in via /auth/login, then every request carries the httpOnly access_token cookie. Errors use { error: { code, message } }.',
  },
  servers: [{ url: '/' }],
  tags: [
    'Health',
    'Auth',
    'Users',
    'Projects',
    'Tasks',
    'Comments',
    'Scheduling',
    'Attachments',
    'Activity',
    'Labels',
    'Notifications',
    'Dashboard',
    'AI',
    'Search',
    'Labels',
    'Statuses',
  ].map((name) => ({ name })),
});
