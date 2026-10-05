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
import {
  createTaskBody,
  listTasksQuery,
  moveTaskBody,
  updateTaskBody,
} from '../modules/tasks';

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
  })
  .openapi('User');

const MemberSchema = z
  .object({
    userId: Id,
    role: Role,
    name: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable().optional(),
  })
  .openapi('Member');

const ProjectSchema = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    ownerId: Id,
    myRole: Role.optional(),
    stats: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('Project');

const TaskSchema = z
  .object({
    id: Id,
    projectId: Id,
    parentId: Id.nullable().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: Status,
    priority: Priority,
    points: z.number().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    estimateHours: z.number().nullable().optional(),
    assigneeId: Id.nullable().optional(),
    tags: z.array(z.string()).optional(),
    position: z.number().optional(),
  })
  .openapi('Task');

const CommentSchema = z
  .object({
    id: Id,
    taskId: Id,
    authorId: Id,
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
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

const ActivityEntrySchema = z
  .object({
    id: Id,
    taskId: Id,
    actorId: Id,
    action: z.string(),
    changes: z.array(z.object({ field: z.string(), oldValue: z.unknown().nullable(), newValue: z.unknown().nullable() })).optional(),
    createdAt: z.string(),
  })
  .openapi('ActivityEntry');

const NotificationSchema = z
  .object({
    id: Id,
    type: z.enum(['ASSIGNED', 'MENTIONED', 'COMMENTED', 'DUE_REMINDER']),
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

// ---- path helpers ---------------------------------------------------------

const pathId = (name: string) =>
  z.coerce.number().int().positive().openapi({ param: { name, in: 'path', required: true } });

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
      search: z.string().min(2).openapi({ param: { name: 'search', in: 'query', required: true } }),
    }),
  },
  responses: { 200: ok(z.array(UserSchema)), 401: error },
});

register({
  method: 'patch',
  path: '/users/me',
  summary: 'Update my profile (name, avatar, locale, theme, notifyEmail)',
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
          })
          .partial(),
      ),
      required: true,
    },
  },
  responses: { 200: ok(UserSchema), 400: error, 401: error },
});

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
  summary: 'Audit trail of a task (newest first)',
  tags: ['Activity'],
  security: auth,
  request: { params: taskParams },
  responses: { 200: ok(z.array(ActivityEntrySchema)), 404: error },
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
  responses: { 200: ok(z.record(z.string(), z.unknown())), 401: error },
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
  tags: ['Health', 'Auth', 'Users', 'Projects', 'Tasks', 'Comments', 'Scheduling', 'Attachments', 'Activity', 'Notifications', 'Dashboard'].map(
    (name) => ({ name }),
  ),
});
