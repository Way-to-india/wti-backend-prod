-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('TOUR_QUERY', 'HOTEL_QUERY', 'TRANSPORT_QUERY', 'CONTACT_US');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "referenceNumber" VARCHAR(20) NOT NULL,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20),
    "details" JSONB NOT NULL,
    "assignedToId" TEXT,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "zohoLeadId" VARCHAR(100),
    "syncedToZoho" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "ipAddress" VARCHAR(50),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "contactedAt" TIMESTAMPTZ(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "activityType" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "performedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_referenceNumber_key" ON "leads"("referenceNumber");

-- CreateIndex
CREATE INDEX "leads_source_status_createdAt_idx" ON "leads"("source", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_status_createdAt_idx" ON "leads"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_referenceNumber_idx" ON "leads"("referenceNumber");

-- CreateIndex
CREATE INDEX "leads_assignedToId_status_idx" ON "leads"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
