-- Phase 4 (Smart scheduling): task effort estimates + dependency graph.
ALTER TABLE "Task" ADD COLUMN "estimateHours" DOUBLE PRECISION;

-- Finish-to-start dependencies between top-level tasks of the same project.
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START');

CREATE TABLE "TaskDependency" (
    "predecessorId" INTEGER NOT NULL,
    "successorId" INTEGER NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("predecessorId", "successorId")
);

ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TaskDependency_successorId_idx" ON "TaskDependency"("successorId");
