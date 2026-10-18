-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "category" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStatus_projectId_position_idx" ON "ProjectStatus"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_projectId_key_key" ON "ProjectStatus"("projectId", "key");

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every project starts with the four built-in columns, in the historical order.
INSERT INTO "ProjectStatus" ("projectId", "key", "label", "color", "category", "position", "updatedAt")
SELECT p."id", s."key", s."label", s."color", s."category"::"TaskStatus", s."position", NOW()
FROM "Project" p
CROSS JOIN (
    VALUES
        ('TODO', 'To Do', '#64748b', 'TODO', 1024::DOUBLE PRECISION),
        ('IN_PROGRESS', 'In Progress', '#3b82f6', 'IN_PROGRESS', 2048::DOUBLE PRECISION),
        ('REVIEW', 'Review', '#a855f7', 'REVIEW', 3072::DOUBLE PRECISION),
        ('DONE', 'Done', '#22c55e', 'DONE', 4096::DOUBLE PRECISION)
) AS s("key", "label", "color", "category", "position");

-- AlterTable: the task keeps its analytics bucket in `status` and gains the workflow key.
ALTER TABLE "Task" ADD COLUMN "statusKey" TEXT NOT NULL DEFAULT 'TODO';

-- Backfill: existing rows used the built-ins as both key and category.
UPDATE "Task" SET "statusKey" = "status"::TEXT;
