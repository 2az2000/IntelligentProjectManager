import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/prisma';
import type { Db } from '../../shared/db/prisma';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { logger } from '../../shared/logger';
import { env } from '../../config/env';
import type { AiService } from '../ai/ai.service';
import { findSemanticTasks } from './vector-store';

const query = z
  .object({
    q: z.string().trim().min(2).max(120),
    semantic: z.enum(['true', 'false']).optional(),
  })
  .strict();

export interface SearchTask {
  id: number;
  projectId: number;
  projectTitle: string;
  title: string;
  status: string;
  /** How this row was found — exact-ish lexical match or nearest embedding. */
  match: 'keyword' | 'semantic';
  similarity?: number;
}

export interface SearchResults {
  tasks: SearchTask[];
  projects: { id: number; title: string }[];
  comments: { id: number; taskId: number; projectId: number; taskTitle: string; snippet: string }[];
  semantic: {
    requested: boolean;
    available: boolean;
    used: boolean;
    /** Only present when the feature was requested but could not run. */
    reason?: 'not_configured' | 'provider_error';
  };
}

export interface SearchDeps {
  db?: Db;
  /** Only the two embedding methods — search has no business calling the chat model. */
  ai: Pick<AiService, 'embeddingAvailable' | 'embedQuery'>;
}

/**
 * §4 global search. v1 was ILIKE-only; v2 adds an optional pgvector pass:
 * lexical results first (exact words still win), then nearest-embedding tasks that the keyword
 * query missed. Embedding failures degrade to lexical and say so, never 500.
 */
export function createSearchRouter(deps: SearchDeps): Router {
  const db = deps.db ?? prisma;
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/status',
    handle({}, async (_input, _req, res) => {
      res.json({
        semantic: {
          available: deps.ai.embeddingAvailable(),
          model: env.AI_EMBEDDING_MODEL,
        },
      });
    }),
  );

  router.get(
    '/',
    handle({ query }, async ({ query: input }, req, res) => {
      const userId = currentUserId(req);
      const memberships = await db.projectMember.findMany({
        where: { userId, project: { deletedAt: null } },
        select: { projectId: true },
      });
      const projectIds = memberships.map((m) => m.projectId);
      if (projectIds.length === 0) {
        res.json({
          tasks: [],
          projects: [],
          comments: [],
          semantic: { requested: input.semantic !== 'false', available: deps.ai.embeddingAvailable(), used: false },
        } satisfies SearchResults);
        return;
      }

      const [tasks, projects, comments] = await Promise.all([
        db.task.findMany({
          where: {
            projectId: { in: projectIds },
            deletedAt: null,
            OR: [{ title: { contains: input.q, mode: 'insensitive' } }, { description: { contains: input.q, mode: 'insensitive' } }],
          },
          select: { id: true, projectId: true, title: true, status: true, project: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        }),
        db.project.findMany({
          where: { id: { in: projectIds }, deletedAt: null, name: { contains: input.q, mode: 'insensitive' } },
          select: { id: true, name: true },
          take: 8,
        }),
        db.comment.findMany({
          where: {
            deletedAt: null,
            task: { projectId: { in: projectIds }, deletedAt: null },
            body: { contains: input.q, mode: 'insensitive' },
          },
          select: { id: true, taskId: true, body: true, task: { select: { title: true, projectId: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const merged: SearchTask[] = tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        projectTitle: t.project.name,
        title: t.title,
        status: t.status,
        match: 'keyword' as const,
      }));

      // Semantic pass: opt-out (`?semantic=false`) rather than opt-in, because recall is the
      // point; the client can turn it off and the failure is always a soft degradation.
      const requested = input.semantic !== 'false';
      const available = deps.ai.embeddingAvailable();
      let used = false;
      let reason: 'not_configured' | 'provider_error' | undefined;
      if (requested && available) {
        const vector = await deps.ai.embedQuery(input.q);
        if (!vector) {
          reason = 'provider_error';
        } else {
          try {
            const matches = await findSemanticTasks(db, vector, projectIds, 12);
            const known = new Set(merged.map((t) => t.id));
            const extra = matches.filter((m) => !known.has(m.taskId) && m.similarity >= 0.2);
            if (extra.length > 0) {
              const rows = await db.task.findMany({
                where: { id: { in: extra.map((m) => m.taskId) }, deletedAt: null },
                select: { id: true, projectId: true, title: true, status: true, project: { select: { name: true } } },
              });
              const similarity = new Map(extra.map((m) => [m.taskId, m.similarity]));
              const byId = new Map(rows.map((row) => [row.id, row]));
              for (const match of [...extra].sort((a, b) => b.similarity - a.similarity)) {
                const row = byId.get(match.taskId);
                if (!row) continue;
                merged.push({
                  id: row.id,
                  projectId: row.projectId,
                  projectTitle: row.project.name,
                  title: row.title,
                  status: row.status,
                  match: 'semantic',
                  similarity: Number((similarity.get(row.id) ?? 0).toFixed(3)),
                });
              }
            }
            used = true;
          } catch (err) {
            logger.warn({ err }, 'Semantic search query failed; returning lexical results');
            reason = 'provider_error';
          }
        }
      } else if (requested) {
        reason = 'not_configured';
      }

      res.json({
        tasks: merged.slice(0, 20),
        projects: projects.map((p) => ({ id: p.id, title: p.name })),
        comments: comments.map((c) => ({
          id: c.id,
          taskId: c.taskId,
          projectId: c.task.projectId,
          taskTitle: c.task.title,
          snippet: c.body.length > 140 ? `${c.body.slice(0, 140)}…` : c.body,
        })),
        semantic: { requested, available, used, ...(reason ? { reason } : {}) },
      } satisfies SearchResults);
    }),
  );

  return router;
}
