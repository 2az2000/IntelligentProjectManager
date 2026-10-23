import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../shared/errors';
import { isTest } from '../../config/env';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import type { AiService } from './ai.service';
import { breakdownBody, chatBody, enrichTaskBody, projectIdParams } from './ai.schemas';
import { taskIdParams } from '../tasks/http/task.schemas';

const standupQuery = z.object({ date: z.coerce.date().optional() }).strict();

/** LLM calls are expensive — a much tighter budget than the global limiter. */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many AI requests, please try again in a minute')),
});

/** Mounted at /projects/:projectId/ai */
export function createAiRouter(service: AiService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  // Preview only: suggestions come back, nothing is written. The client applies
  // them through the regular task endpoints once the user reviews them.
  router.post(
    '/enrich-task',
    aiLimiter,
    handle({ params: projectIdParams, body: enrichTaskBody }, async ({ params, body }, req, res) => {
      res.json(await service.enrichTask(currentUserId(req), params.projectId, body));
    }),
  );

  router.post(
    '/project-doc',
    aiLimiter,
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await service.generateProjectDoc(currentUserId(req), params.projectId));
    }),
  );

  // §2 stand-up assistant (optional ?date=, defaults to yesterday/today window).
  router.get(
    '/standup',
    aiLimiter,
    handle({ params: projectIdParams, query: standupQuery }, async ({ params, query }, req, res) => {
      res.json(await service.standup(currentUserId(req), params.projectId, query.date));
    }),
  );

  // §2 auto-tagging from the project's own tag vocabulary.
  router.post(
    '/suggest-tags',
    aiLimiter,
    handle({ params: projectIdParams, body: enrichTaskBody }, async ({ params, body }, req, res) => {
      res.json(await service.suggestTags(currentUserId(req), params.projectId, body));
    }),
  );

  // §2 PRD → a previewed task breakdown (the client creates through normal endpoints).
  router.post(
    '/breakdown',
    aiLimiter,
    handle({ params: projectIdParams, body: breakdownBody }, async ({ params, body }, req, res) => {
      res.json(await service.breakdownPrd(currentUserId(req), params.projectId, body));
    }),
  );

  // §AI project chat — read-only, scoped by the asking user's role (VIEWER+).
  router.post(
    '/chat',
    aiLimiter,
    handle({ params: projectIdParams, body: chatBody }, async ({ params, body }, req, res) => {
      res.json(await service.chatAboutProject(currentUserId(req), params.projectId, body));
    }),
  );

  // §AI weekly summary, generated on demand (the Monday job uses the same service method).
  router.post(
    '/weekly-summary',
    aiLimiter,
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await service.weeklySummary(currentUserId(req), params.projectId));
    }),
  );

  // §AI semantic search backfill for tasks created before embeddings were enabled.
  router.post(
    '/embeddings/backfill',
    aiLimiter,
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await service.embedProjectTasks(currentUserId(req), params.projectId));
    }),
  );

  return router;
}

/** Mounted at /tasks/:taskId/ai — task-scoped AI helpers. */
export function createTaskAiRouter(service: AiService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  // §2 summarize a long comment thread.
  router.post(
    '/summarize-thread',
    aiLimiter,
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      res.json(await service.summarizeThread(currentUserId(req), params.taskId));
    }),
  );

  return router;
}
