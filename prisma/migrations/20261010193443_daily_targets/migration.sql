CREATE TABLE "DailyTarget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pic" TEXT NOT NULL,
  "scheduledDate" DATE NOT NULL,
  "originalDate" DATE NOT NULL,
  "targetQty" DECIMAL(18,4) NOT NULL CHECK ("targetQty" > 0),
  "actualQty" DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK ("actualQty" >= 0),
  "unit" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM' CHECK ("priority" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK ("status" IN ('NOT_STARTED','IN_PROGRESS','DONE','BLOCKED','CANCELLED')),
  "notes" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyTarget_completion_check" CHECK (("status" = 'DONE' AND "actualQty" >= "targetQty" AND "completedAt" IS NOT NULL) OR ("status" <> 'DONE' AND "completedAt" IS NULL)),
  CONSTRAINT "DailyTarget_not_started_check" CHECK ("status" <> 'NOT_STARTED' OR "actualQty" = 0),
  CONSTRAINT "DailyTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DailyTarget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DailyTarget_requestId_key" ON "DailyTarget"("requestId");
CREATE INDEX "DailyTarget_projectId_scheduledDate_idx" ON "DailyTarget"("projectId", "scheduledDate");
CREATE INDEX "DailyTarget_scheduledDate_status_idx" ON "DailyTarget"("scheduledDate", "status");
CREATE INDEX "DailyTarget_createdById_idx" ON "DailyTarget"("createdById");
ALTER TABLE "DailyTarget" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "DailyTarget" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "DailyTarget" FROM authenticated; END IF;
END $$;
