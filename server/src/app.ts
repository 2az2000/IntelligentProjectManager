import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { env, isProduction, isTest } from './config/env';
import { logger } from './shared/logger';
import { prisma, type Db } from './shared/db/prisma';
import { AppError } from './shared/errors';
import { errorHandler, notFoundHandler } from './shared/http/error-handler';
import { originGuard } from './shared/http/origin-guard';
import { openapiDocument } from './shared/openapi';
import { createAuthModule } from './modules/auth';
import { createUsersModule } from './modules/users';
import { createProjectsModule } from './modules/projects';
import { createTasksModule } from './modules/tasks';
import { createCommentsModule } from './modules/comments';
import { createDashboardModule } from './modules/dashboard';
import { createSchedulingModule } from './modules/scheduling';
import { createActivityModule } from './modules/activity';
import { createAttachmentsModule } from './modules/attachments';
import { createSearchRouter } from './modules/search';
import { createNotificationsModule } from './modules/notifications';
import { createJobsModule } from './modules/jobs';
import { createAiModule } from './modules/ai';
import { publish } from './shared/realtime/bus';

export function createApp(deps: { db: Db } = { db: prisma }) {
  const app = express();
  const { db } = deps;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      // API + Swagger UI at /docs: swagger-ui-express ships inline bootstrap scripts/styles.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Phase 6: CSRF defense-in-depth (cookie auth) + a global per-IP request budget.
  app.use(originGuard);
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.RATE_LIMIT_PER_MINUTE,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.path === '/health' || isTest,
      handler: (_req, _res, next) =>
        next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down')),
    }),
  );

  app.get('/health', async (_req, res) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }
    const ok = dbStatus === 'ok';
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', db: dbStatus });
  });

  // Composition root: modules are wired here and only talk through their public APIs.
  const users = createUsersModule({ db });
  const auth = createAuthModule({ db, users: users.service });
  const projects = createProjectsModule({ db, users: users.service });
  const tasks = createTasksModule({ db, projects: projects.service });
  const comments = createCommentsModule({ db, tasks: tasks.service });
  const dashboard = createDashboardModule({ db, projects: projects.service });
  const scheduling = createSchedulingModule({ db, projects: projects.service });
  // §11 templates: projects may create tasks/dependencies through the owning modules
  // (wired after both modules exist — the closure resolves them lazily at call time).
  projects.service.templateApply = {
    createTask: async (userId, projectId, input) => {
      const task = await tasks.service.create(userId, {
        projectId,
        title: input.title,
        description: input.description ?? undefined,
        priority: input.priority,
        estimateHours: input.estimateHours ?? undefined,
      });
      return task.id;
    },
    linkDependency: (userId, _projectId, predecessorId, successorId) =>
      scheduling.dependencies.create(userId, predecessorId, successorId).then(() => undefined),
  };
  const activity = createActivityModule({ db, tasks: tasks.service });
  const attachments = createAttachmentsModule({ db, tasks: tasks.service });
  const notifications = createNotificationsModule({ db });
  // Disabled in tests (and wherever REDIS_URL is unreachable).
  const jobs = createJobsModule({ db });
  // Phase 7: AI previews (task enrichment + project docs) — 503 without AI_API_KEY.
  const ai = createAiModule({ db, projects: projects.service });

  // Cross-module reaction without a hard dependency from projects to tasks.
  projects.service.hooks.onMemberRemoved = (projectId, userId) =>
    tasks.service.unassignUser(projectId, userId);

  // Phase 5: activity log + realtime broadcast + assignment notifications + reminder jobs.
  // Awaited by the task service: activity rows and notifications exist before the
  // HTTP response; only the BullMQ reminder scheduling stays fire-and-forget.
  tasks.service.hooks.onChanged = async (event) => {
    await activity.service.record({ actorId: event.actorId, taskId: event.taskId, action: event.kind, changes: event.changes });
    publish('task:changed', {
      projectId: event.projectId,
      taskId: event.taskId,
      kind: event.kind,
      actorId: event.actorId,
      changes: event.changes,
    });
    for (const userId of event.notifyUserIds ?? []) {
      await notifications.service.create({
        userId,
        type: 'ASSIGNED',
        actorId: event.actorId,
        taskId: event.taskId,
        projectId: event.projectId,
      });
    }
    if (event.kind === 'created' || event.kind === 'updated') {
      void jobs.scheduleDueReminder(event.taskId);
    }
  };

  comments.service.hooks.onCreated = async (event) => {
    publish('comment:created', {
      projectId: event.projectId,
      taskId: event.taskId,
      commentId: event.commentId,
      authorId: event.authorId,
      mentionedUserIds: event.mentionedUserIds,
    });
    if (event.assigneeId && event.assigneeId !== event.authorId) {
      await notifications.service.create({
        userId: event.assigneeId,
        type: 'COMMENTED',
        actorId: event.authorId,
        taskId: event.taskId,
        projectId: event.projectId,
      });
    }
    for (const userId of event.mentionedUserIds) {
      if (userId === event.authorId) continue;
      await notifications.service.create({
        userId,
        type: 'MENTIONED',
        actorId: event.authorId,
        taskId: event.taskId,
        projectId: event.projectId,
      });
    }
  };

  app.use('/auth', auth.router);
  app.use('/users', users.router);
  app.use('/projects/:projectId/tasks', tasks.bulkRouter, tasks.projectTasksRouter);
  app.use('/projects/:projectId/cost', tasks.projectCostRouter);
  app.use('/projects/:projectId/ai', ai.aiRouter);
  app.use('/projects', projects.router);
  app.use('/tasks/:taskId/comments', comments.taskCommentsRouter);
  app.use('/tasks/:taskId/time', tasks.taskTimeRouter);
  app.use('/tasks/:taskId/ai', ai.taskAiRouter);
  app.use('/tasks', tasks.tasksRouter);
  app.use('/comments', comments.commentsRouter);
  app.use('/me', tasks.myTimeRouter, tasks.myTasksRouter, projects.teamRouter);
  app.use('/dashboard', dashboard.router);
  app.use('/search', createSearchRouter());
  app.use('/projects/:projectId/schedule', scheduling.projectScheduleRouter);
  app.use('/projects/:projectId/dependencies', scheduling.dependenciesRouter);
  app.use('/projects/:projectId', scheduling.analyticsRouter);
  app.use('/tasks/:taskId/schedule', scheduling.taskScheduleRouter);
  app.use('/holidays', scheduling.holidaysRouter);
  app.use('/tasks/:taskId/attachments', attachments.taskAttachmentsRouter);
  app.use('/tasks/:taskId/activity', activity.activityRouter);
  app.use('/attachments', attachments.attachmentsRouter);
  app.use('/notifications', notifications.notificationsRouter);

  // Phase 6: interactive API docs (Swagger UI) outside production only.
  if (!isProduction) {
    app.get('/docs.json', (_req, res) => res.json(openapiDocument));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  // main.ts picks this up for graceful shutdown (no-op in tests).
  app.set('jobs', jobs);

  return app;
}
