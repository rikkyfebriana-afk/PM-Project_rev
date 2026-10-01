ALTER TABLE "Project" ADD COLUMN "timePlanActive" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "PlanTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "phase" "ProjectPhase" NOT NULL,
  "title" TEXT NOT NULL,
  "responsible" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "weight" DECIMAL(5,2) NOT NULL CHECK ("weight" > 0 AND "weight" <= 100),
  "progressPct" DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK ("progressPct" >= 0 AND "progressPct" <= 100),
  "plannedStart" DATE NOT NULL,
  "plannedFinish" DATE NOT NULL,
  "actualStart" DATE,
  "actualFinish" DATE,
  "predecessorId" TEXT,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanTask_id_projectId_key" UNIQUE ("id","projectId"),
  CONSTRAINT "PlanTask_dates_check" CHECK ("plannedFinish" >= "plannedStart" AND ("actualFinish" IS NULL OR ("actualStart" IS NOT NULL AND "actualFinish" >= "actualStart"))),
  CONSTRAINT "PlanTask_progress_check" CHECK (("progressPct" = 0 OR "actualStart" IS NOT NULL) AND (("progressPct" = 100) = ("actualFinish" IS NOT NULL))),
  CONSTRAINT "PlanTask_phase_check" CHECK ("phase" <> 'CLOSED'),
  CONSTRAINT "PlanTask_self_check" CHECK ("predecessorId" IS NULL OR "predecessorId" <> "id"),
  CONSTRAINT "PlanTask_predecessor_fkey" FOREIGN KEY ("predecessorId","projectId") REFERENCES "PlanTask"("id","projectId") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "PlanTask_projectId_archivedAt_sortOrder_idx" ON "PlanTask"("projectId","archivedAt","sortOrder");
CREATE INDEX "PlanTask_predecessorId_projectId_idx" ON "PlanTask"("predecessorId","projectId");
ALTER TABLE "PlanTask" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PlanTask" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "PlanTask" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "PlanTask" FROM authenticated; END IF;
END $$;
