CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROJECT_MANAGER', 'VIEWER');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED', 'CANCELLED');
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'ATTENTION', 'CRITICAL');
CREATE TYPE "ProjectPhase" AS ENUM ('PLANNING', 'ENGINEERING', 'PROCUREMENT', 'PRODUCTION', 'FAT', 'DELIVERY', 'INSTALLATION', 'BAST', 'CLOSED');
CREATE TYPE "BoqStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "MaterialStatus" AS ENUM ('PLANNED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'INSTALLED', 'SHORTAGE');
CREATE TYPE "MilestoneStatus" AS ENUM ('UPCOMING', 'AT_RISK', 'OVERDUE', 'COMPLETED');
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED');
CREATE TYPE "DocumentCategory" AS ENUM ('BOQ', 'PURCHASE_ORDER', 'PROGRESS_PHOTO', 'FAT', 'DELIVERY_ORDER', 'BAST', 'CONTRACT', 'OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK',
    "phase" "ProjectPhase" NOT NULL DEFAULT 'PLANNING',
    "progressPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "poValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "budgetValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "forecastCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "plannedStart" DATE,
    "plannedFinish" DATE,
    "actualFinish" DATE,
    "projectManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Project_progressPct_check" CHECK ("progressPct" >= 0 AND "progressPct" <= 100),
    CONSTRAINT "Project_financials_check" CHECK ("poValue" >= 0 AND "budgetValue" >= 0 AND "actualCost" >= 0 AND "forecastCost" >= 0),
    CONSTRAINT "Project_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    CONSTRAINT "Project_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Boq" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BoqStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Boq_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Boq_version_check" CHECK ("version" > 0)
);

CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "boqId" TEXT NOT NULL,
    "itemNo" TEXT NOT NULL,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BoqItem_values_check" CHECK ("quantity" >= 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0)
);

CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "boqItemId" TEXT,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "requiredQty" DECIMAL(18,4) NOT NULL,
    "orderedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "installedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "purchaseOrderNo" TEXT,
    "needByDate" DATE,
    "estimatedArrival" DATE,
    "status" "MaterialStatus" NOT NULL DEFAULT 'PLANNED',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Material_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Material_quantities_check" CHECK ("requiredQty" >= 0 AND "orderedQty" >= 0 AND "receivedQty" >= 0 AND "installedQty" >= 0)
);

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" "ProjectPhase",
    "plannedDate" DATE NOT NULL,
    "completedAt" TIMESTAMP(3),
    "progressPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'UPCOMING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Milestone_progressPct_check" CHECK ("progressPct" >= 0 AND "progressPct" <= 100)
);

CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "materialId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "originalName" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Document_sizeBytes_check" CHECK ("sizeBytes" > 0)
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_normalizedUsername_key" ON "User"("normalizedUsername");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");
CREATE INDEX "Project_status_health_idx" ON "Project"("status", "health");
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");
CREATE INDEX "Project_plannedFinish_idx" ON "Project"("plannedFinish");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "Boq_projectId_status_idx" ON "Boq"("projectId", "status");
CREATE UNIQUE INDEX "Boq_projectId_version_key" ON "Boq"("projectId", "version");
CREATE INDEX "BoqItem_boqId_idx" ON "BoqItem"("boqId");
CREATE UNIQUE INDEX "BoqItem_boqId_itemNo_key" ON "BoqItem"("boqId", "itemNo");
CREATE INDEX "Material_projectId_status_idx" ON "Material"("projectId", "status");
CREATE INDEX "Material_needByDate_idx" ON "Material"("needByDate");
CREATE INDEX "Milestone_projectId_plannedDate_idx" ON "Milestone"("projectId", "plannedDate");
CREATE INDEX "Milestone_status_plannedDate_idx" ON "Milestone"("status", "plannedDate");
CREATE INDEX "ActionItem_projectId_status_idx" ON "ActionItem"("projectId", "status");
CREATE INDEX "ActionItem_assigneeId_status_idx" ON "ActionItem"("assigneeId", "status");
CREATE INDEX "ActionItem_priority_dueAt_idx" ON "ActionItem"("priority", "dueAt");
CREATE INDEX "Document_projectId_category_status_idx" ON "Document"("projectId", "category", "status");
CREATE UNIQUE INDEX "Document_bucket_objectKey_key" ON "Document"("bucket", "objectKey");
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Boq" ADD CONSTRAINT "Boq_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "Boq"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
