-- §AI semantic search: pgvector storage for task title+description embeddings.
-- The column dimension is fixed (1536 = OpenAI text-embedding-3-small); changing the embedding
-- model to one with a different dimension requires a new migration, not just an env change.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Task" ADD COLUMN "embedding" vector(1536);

-- Cosine distance index; `vector_cosine_ops` matches the `<=>` operator used in search.
CREATE INDEX "Task_embedding_idx" ON "Task" USING hnsw ("embedding" vector_cosine_ops);
