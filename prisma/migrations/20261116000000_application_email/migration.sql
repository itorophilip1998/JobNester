-- AlterTable
ALTER TABLE "Application" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Application" ADD COLUMN "emailDraft" JSONB;
ALTER TABLE "Application" ADD COLUMN "sendStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Application" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "composeTaskId" TEXT;
