-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "budgetAmount" DECIMAL(14,2),
ADD COLUMN     "hourlyRate" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "budgetAmount" DECIMAL(14,2),
ADD COLUMN     "capacityHoursPerWeek" INTEGER,
ADD COLUMN     "hourlyRate" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "projectMemberProjectId" INTEGER,
    "projectMemberUserId" INTEGER,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_userId_endedAt_key" ON "TimeEntry"("userId", "endedAt");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectMemberProjectId_projectMemberUserId_fkey" FOREIGN KEY ("projectMemberProjectId", "projectMemberUserId") REFERENCES "ProjectMember"("projectId", "userId") ON DELETE SET NULL ON UPDATE CASCADE;
