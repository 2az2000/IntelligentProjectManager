import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './shared/logger';
import { prisma, type Db } from './shared/db/prisma';
import { errorHandler, notFoundHandler } from './shared/http/error-handler';
import { createAuthModule } from './modules/auth';
import { createUsersModule } from './modules/users';
import { createProjectsModule } from './modules/projects';
import { createTasksModule } from './modules/tasks';
import { createCommentsModule } from './modules/comments';
import { createDashboardModule } from './modules/dashboard';

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
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

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

  // Cross-module reaction without a hard dependency from projects to tasks.
  projects.service.hooks.onMemberRemoved = (projectId, userId) =>
    tasks.service.unassignUser(projectId, userId);

  app.use('/auth', auth.router);
  app.use('/users', users.router);
  app.use('/projects/:projectId/tasks', tasks.projectTasksRouter);
  app.use('/projects', projects.router);
  app.use('/tasks/:taskId/comments', comments.taskCommentsRouter);
  app.use('/tasks', tasks.tasksRouter);
  app.use('/comments', comments.commentsRouter);
  app.use('/me', tasks.myTasksRouter, projects.teamRouter);
  app.use('/dashboard', dashboard.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
