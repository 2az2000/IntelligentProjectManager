import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/prisma';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';

const query = z.object({ q: z.string().trim().min(2).max(120) }).strict();

export interface SearchResults {
  tasks: { id: number; projectId: number; projectTitle: string; title: string; status: string }[];
  projects: { id: number; title: string }[];
  comments: { id: number; taskId: number; taskTitle: string; snippet: string }[];
}

/**
 * §4 global search, v1: ILIKE over the projects the user belongs to.
 * (pg_trgm/pgvector upgrades can replace the WHERE without touching the contract.)
 */
export function createSearchRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    handle({ query }, async ({ query: input }, req, res) => {
      const userId = currentUserId(req);
      const memberships = await prisma.projectMember.findMany({
        where: { userId, project: { deletedAt: null } },
        select: { projectId: true },
      });
      const projectIds = memberships.map((m) => m.projectId);
      if (projectIds.length === 0) {
        res.json({ tasks: [], projects: [], comments: [] });
        return;
      }

      const [tasks, projects, comments] = await Promise.all([
        prisma.task.findMany({
          where: {
            projectId: { in: projectIds },
            deletedAt: null,
            OR: [{ title: { contains: input.q, mode: 'insensitive' } }, { description: { contains: input.q, mode: 'insensitive' } }],
          },
          select: { id: true, projectId: true, title: true, status: true, project: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        }),
        prisma.project.findMany({
          where: { id: { in: projectIds }, deletedAt: null, name: { contains: input.q, mode: 'insensitive' } },
          select: { id: true, name: true },
          take: 8,
        }),
        prisma.comment.findMany({
          where: {
            deletedAt: null,
            task: { projectId: { in: projectIds }, deletedAt: null },
            body: { contains: input.q, mode: 'insensitive' },
          },
          select: { id: true, taskId: true, body: true, task: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      res.json({
        tasks: tasks.map((t) => ({ id: t.id, projectId: t.projectId, projectTitle: t.project.name, title: t.title, status: t.status })),
        projects: projects.map((p) => ({ id: p.id, title: p.name })),
        comments: comments.map((c) => ({
          id: c.id,
          taskId: c.taskId,
          taskTitle: c.task.title,
          snippet: c.body.length > 140 ? `${c.body.slice(0, 140)}…` : c.body,
        })),
      });
    }),
  );

  return router;
}
