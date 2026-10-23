import type { Db } from '../../shared/db/prisma';

/**
 * pgvector access for semantic task search. Prisma cannot type `vector`, so this is the one
 * place that speaks raw SQL; the query text and ids are always bound parameters.
 */

/** `number[]` → the `[1,2,3]` literal pgvector casts from text. */
export const toVectorLiteral = (vector: number[]): string => `[${vector.join(',')}]`;

export interface SemanticMatch {
  taskId: number;
  /** Cosine similarity in 0..1 (1 = identical direction). */
  similarity: number;
}

/**
 * Nearest tasks by cosine distance, restricted to the caller's projects.
 * `<=>` is cosine distance, matching the `vector_cosine_ops` index in the migration.
 */
export async function findSemanticTasks(
  db: Db,
  vector: number[],
  projectIds: number[],
  limit = 12,
): Promise<SemanticMatch[]> {
  if (projectIds.length === 0) return [];
  const rows = await db.$queryRawUnsafe<{ id: number; similarity: number }[]>(
    `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
       FROM "Task"
      WHERE "deletedAt" IS NULL
        AND embedding IS NOT NULL
        AND "projectId" = ANY($2::int[])
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    toVectorLiteral(vector),
    projectIds,
    limit,
  );
  return rows
    .map((row) => ({ taskId: Number(row.id), similarity: Number(row.similarity) }))
    .filter((row) => Number.isFinite(row.similarity));
}
