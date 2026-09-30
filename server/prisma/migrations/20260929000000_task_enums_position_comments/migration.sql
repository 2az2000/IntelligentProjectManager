-- Phase 3: task enums, ordering, soft delete, comment timestamps. Hand-written to preserve data.

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- ---------------------------------------------------------------------------------------------
-- Task: convert display strings ('To Do', 'High', ...) to enums in place.
DROP INDEX "Task_projectId_idx";

ALTER TABLE "Task"
  ALTER COLUMN "status" TYPE "TaskStatus" USING (
    CASE "status"
      WHEN 'In Progress' THEN 'IN_PROGRESS'
      WHEN 'Review' THEN 'REVIEW'
      WHEN 'Done' THEN 'DONE'
      ELSE 'TODO'
    END
  )::"TaskStatus",
  ALTER COLUMN "status" SET DEFAULT 'TODO',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "priority" TYPE "TaskPriority" USING (
    CASE "priority"
      WHEN 'Low' THEN 'LOW'
      WHEN 'High' THEN 'HIGH'
      WHEN 'Urgent' THEN 'URGENT'
      ELSE 'MEDIUM'
    END
  )::"TaskPriority",
  ALTER COLUMN "priority" SET DEFAULT 'MEDIUM',
  ALTER COLUMN "priority" SET NOT NULL,
  -- Comma-separated tags become a text array.
  ALTER COLUMN "tags" TYPE TEXT[] USING (
    CASE WHEN "tags" IS NULL OR btrim("tags") = '' THEN ARRAY[]::TEXT[]
         ELSE string_to_array(regexp_replace("tags", '\s*,\s*', ',', 'g'), ',')
    END
  ),
  ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Initial ordering: current id order inside each (project, status) column, spaced by 1024.
UPDATE "Task" t SET "position" = ranked.rn * 1024
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId", "status" ORDER BY "id") AS rn
  FROM "Task"
) ranked
WHERE t."id" = ranked."id";

UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE';

-- ---------------------------------------------------------------------------------------------
-- Comment: rename columns and add timestamps.
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_userId_fkey";
ALTER TABLE "Comment" RENAME COLUMN "text" TO "body";
ALTER TABLE "Comment" RENAME COLUMN "userId" TO "authorId";
ALTER TABLE "Comment"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------------------------
-- Project: archive and soft delete.
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_projectId_status_position_idx" ON "Task"("projectId", "status", "position");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
