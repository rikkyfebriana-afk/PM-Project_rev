ALTER TABLE "Project" ADD COLUMN "costOpeningBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;
UPDATE "Project" SET "costOpeningBalance" = "actualCost";
ALTER TABLE "Milestone" ADD COLUMN "referenceNo" TEXT, ADD COLUMN "responsible" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ActionItem_milestoneId_status_idx" ON "ActionItem"("milestoneId", "status");
CREATE TABLE "CostEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "referenceNo" TEXT,
  "amount" DECIMAL(18,2) NOT NULL CHECK ("amount" > 0),
  "spentAt" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "CostEntry_category_check" CHECK ("category" IN ('MATERIAL', 'LABOR', 'SUBCONTRACT', 'TRANSPORT', 'OTHER'))
);
CREATE INDEX "CostEntry_projectId_spentAt_idx" ON "CostEntry"("projectId", "spentAt");
CREATE FUNCTION enforce_action_milestone_project() RETURNS trigger AS $$
BEGIN
  IF NEW."milestoneId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Milestone" WHERE "id" = NEW."milestoneId" AND "projectId" = NEW."projectId"
  ) THEN
    RAISE EXCEPTION 'Action and milestone must belong to the same project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ActionItem_same_project_trigger" BEFORE INSERT OR UPDATE OF "milestoneId", "projectId" ON "ActionItem"
FOR EACH ROW EXECUTE FUNCTION enforce_action_milestone_project();
