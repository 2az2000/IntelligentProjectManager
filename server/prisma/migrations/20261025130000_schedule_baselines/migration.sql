-- §2.2: captured CPM snapshots so "how far behind the plan are we" has an answer.

-- CreateTable
CREATE TABLE "ScheduleBaseline" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "projectDurationHours" DOUBLE PRECISION NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBaselineItem" (
    "id" SERIAL NOT NULL,
    "baselineId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startHours" DOUBLE PRECISION,
    "finishHours" DOUBLE PRECISION,
    "estimateHours" DOUBLE PRECISION,

    CONSTRAINT "ScheduleBaselineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBaseline_projectId_createdAt_idx" ON "ScheduleBaseline"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleBaselineItem_baselineId_idx" ON "ScheduleBaselineItem"("baselineId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaselineItem_baselineId_taskId_key" ON "ScheduleBaselineItem"("baselineId", "taskId");

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaselineItem" ADD CONSTRAINT "ScheduleBaselineItem_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "ScheduleBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

