-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
