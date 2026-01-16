/*
  Warnings:

  - The values [QUALIFIED,CONVERTED,REJECTED,FOLLOW_UP] on the enum `LeadStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `lastSyncedAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `syncedToZoho` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `zohoLeadId` on the `leads` table. All the data in the column will be lost.
  - The `priority` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "LeadQuality" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "LeadServiceType" AS ENUM ('TOUR', 'HOTEL', 'TRANSPORT', 'MIXED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'SMS', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP', 'CALLBACK', 'QUOTE_FOLLOW_UP', 'GENERAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'WEBSITE_FORM';
ALTER TYPE "LeadSource" ADD VALUE 'PHONE_CALL';
ALTER TYPE "LeadSource" ADD VALUE 'EMAIL';
ALTER TYPE "LeadSource" ADD VALUE 'WHATSAPP';
ALTER TYPE "LeadSource" ADD VALUE 'FACEBOOK';
ALTER TYPE "LeadSource" ADD VALUE 'INSTAGRAM';
ALTER TYPE "LeadSource" ADD VALUE 'GOOGLE_ADS';
ALTER TYPE "LeadSource" ADD VALUE 'REFERRAL';
ALTER TYPE "LeadSource" ADD VALUE 'WALK_IN';
ALTER TYPE "LeadSource" ADD VALUE 'OTHER';

-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'QUOTED', 'NEGOTIATING', 'FOLLOW_UP_SCHEDULED', 'CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED');
ALTER TABLE "public"."leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "public"."LeadStatus_old";
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_adminId_fkey";

-- DropIndex
DROP INDEX "leads_assignedToId_status_idx";

-- DropIndex
DROP INDEX "leads_status_createdAt_idx";

-- AlterTable
ALTER TABLE "lead_activities" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "lastSyncedAt",
DROP COLUMN "notes",
DROP COLUMN "syncedToZoho",
DROP COLUMN "zohoLeadId",
ADD COLUMN     "actualValue" INTEGER,
ADD COLUMN     "alternatePhone" VARCHAR(20),
ADD COLUMN     "assignedAt" TIMESTAMPTZ(3),
ADD COLUMN     "budgetMax" INTEGER,
ADD COLUMN     "budgetMin" INTEGER,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "city" VARCHAR(150),
ADD COLUMN     "closedAt" TIMESTAMPTZ(3),
ADD COLUMN     "conversionProbability" DECIMAL(5,2),
ADD COLUMN     "destination" VARCHAR(255),
ADD COLUMN     "estimatedValue" INTEGER,
ADD COLUMN     "firstResponseAt" TIMESTAMPTZ(3),
ADD COLUMN     "followUpCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isOverdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivityAt" TIMESTAMPTZ(3),
ADD COLUMN     "leadScore" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMPTZ(3),
ADD COLUMN     "numberOfAdults" SMALLINT,
ADD COLUMN     "numberOfChildren" SMALLINT,
ADD COLUMN     "numberOfTravelers" SMALLINT,
ADD COLUMN     "quality" "LeadQuality",
ADD COLUMN     "responseTimeMinutes" INTEGER,
ADD COLUMN     "serviceType" "LeadServiceType",
ADD COLUMN     "specialRequests" TEXT,
ADD COLUMN     "tagId" TEXT,
ADD COLUMN     "travelEndDate" TIMESTAMPTZ(3),
ADD COLUMN     "travelStartDate" TIMESTAMPTZ(3),
ALTER COLUMN "details" DROP NOT NULL,
DROP COLUMN "priority",
ADD COLUMN     "priority" "LeadPriority" NOT NULL DEFAULT 'WARM';

-- DropTable
DROP TABLE "notifications";

-- CreateTable
CREATE TABLE "lead_tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "icon" VARCHAR(50),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_source_masters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_source_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "icon" VARCHAR(50),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStatus" VARCHAR(50),
    "toStatus" VARCHAR(50) NOT NULL,
    "fromTag" VARCHAR(100),
    "toTag" VARCHAR(100),
    "notes" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_quotations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "version" SMALLINT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileKey" VARCHAR(500) NOT NULL,
    "fileUrl" VARCHAR(1000) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "amount" INTEGER,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMPTZ(3),
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailOpenedAt" TIMESTAMPTZ(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_communications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT,
    "duration" INTEGER,
    "status" VARCHAR(50),
    "metadata" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_reminders" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "reminderType" "ReminderType" NOT NULL,
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(3),
    "isSnoozed" BOOLEAN NOT NULL DEFAULT false,
    "snoozeReason" TEXT,
    "snoozedUntil" TIMESTAMPTZ(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_name_key" ON "lead_tags"("name");

-- CreateIndex
CREATE INDEX "lead_tags_isActive_order_idx" ON "lead_tags"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_tags_name_idx" ON "lead_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_masters_name_key" ON "lead_source_masters"("name");

-- CreateIndex
CREATE INDEX "lead_source_masters_isActive_order_idx" ON "lead_source_masters"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_source_masters_name_idx" ON "lead_source_masters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_categories_name_key" ON "lead_categories"("name");

-- CreateIndex
CREATE INDEX "lead_categories_isActive_order_idx" ON "lead_categories"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_categories_name_idx" ON "lead_categories"("name");

-- CreateIndex
CREATE INDEX "lead_status_history_leadId_createdAt_idx" ON "lead_status_history"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_quotations_leadId_createdAt_idx" ON "lead_quotations"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_quotations_isAccepted_idx" ON "lead_quotations"("isAccepted");

-- CreateIndex
CREATE UNIQUE INDEX "lead_quotations_leadId_version_key" ON "lead_quotations"("leadId", "version");

-- CreateIndex
CREATE INDEX "lead_communications_leadId_createdAt_idx" ON "lead_communications"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_communications_type_createdAt_idx" ON "lead_communications"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_reminders_leadId_scheduledFor_idx" ON "lead_reminders"("leadId", "scheduledFor");

-- CreateIndex
CREATE INDEX "lead_reminders_assignedToId_isCompleted_scheduledFor_idx" ON "lead_reminders"("assignedToId", "isCompleted", "scheduledFor");

-- CreateIndex
CREATE INDEX "lead_reminders_scheduledFor_isCompleted_idx" ON "lead_reminders"("scheduledFor", "isCompleted");

-- CreateIndex
CREATE INDEX "lead_activities_activityType_idx" ON "lead_activities"("activityType");

-- CreateIndex
CREATE INDEX "leads_status_priority_createdAt_idx" ON "leads"("status", "priority", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_assignedToId_status_priority_idx" ON "leads"("assignedToId", "status", "priority");

-- CreateIndex
CREATE INDEX "leads_priority_leadScore_idx" ON "leads"("priority", "leadScore" DESC);

-- CreateIndex
CREATE INDEX "leads_nextFollowUpAt_idx" ON "leads"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "leads_isOverdue_assignedToId_idx" ON "leads"("isOverdue", "assignedToId");

-- CreateIndex
CREATE INDEX "leads_tagId_idx" ON "leads"("tagId");

-- CreateIndex
CREATE INDEX "leads_categoryId_idx" ON "leads"("categoryId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "lead_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "lead_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quotations" ADD CONSTRAINT "lead_quotations_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quotations" ADD CONSTRAINT "lead_quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_communications" ADD CONSTRAINT "lead_communications_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_communications" ADD CONSTRAINT "lead_communications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
