ALTER TABLE "Boq"
ADD COLUMN "sourceFileName" TEXT,
ADD COLUMN "sourceSheetName" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "sourceDocumentId" TEXT;

CREATE TYPE "BoqItemType" AS ENUM ('MATERIAL', 'SERVICE', 'OTHER');

ALTER TABLE "BoqItem"
ADD COLUMN "itemType" "BoqItemType" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Material"
ADD COLUMN "normalizedCode" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Boq"
    WHERE "status" = 'APPROVED'
    GROUP BY "projectId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'More than one approved BoQ exists per project. Reconcile legacy baselines before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Material"
    WHERE "boqItemId" IS NOT NULL
    GROUP BY "boqItemId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple materials refer to one BoQ item. Reconcile legacy links before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Boq"
    WHERE "sourceHash" IS NOT NULL
    GROUP BY "projectId", "sourceHash" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate BoQ source hashes exist within a project. Reconcile legacy imports before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Boq"
    WHERE "sourceHash" IS NOT NULL
      AND "sourceHash" !~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'Invalid legacy BoQ source hash. Normalize it before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Material"
    WHERE "code" IS NOT NULL AND trim("code") <> ''
    GROUP BY "projectId", upper(trim(regexp_replace("code", '[[:space:]]+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate material codes exist within a project. Reconcile legacy procurement records before migrating.';
  END IF;
END;
$$;

UPDATE "Material"
SET "normalizedCode" = upper(trim(regexp_replace("code", '[[:space:]]+', ' ', 'g')))
WHERE "code" IS NOT NULL AND trim("code") <> '';

CREATE UNIQUE INDEX "Boq_projectId_sourceHash_key"
ON "Boq"("projectId", "sourceHash");

CREATE UNIQUE INDEX "Boq_one_approved_per_project_key"
ON "Boq"("projectId")
WHERE "status" = 'APPROVED';

CREATE INDEX "Boq_createdById_idx" ON "Boq"("createdById");
CREATE INDEX "Boq_approvedById_idx" ON "Boq"("approvedById");

CREATE UNIQUE INDEX "Boq_sourceDocumentId_key" ON "Boq"("sourceDocumentId");

CREATE UNIQUE INDEX "Material_boqItemId_key"
ON "Material"("boqItemId");

CREATE UNIQUE INDEX "Material_projectId_normalizedCode_key"
ON "Material"("projectId", "normalizedCode");

CREATE INDEX "Material_projectId_isActive_idx"
ON "Material"("projectId", "isActive");

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_sourceHash_check"
CHECK ("sourceHash" IS NULL OR "sourceHash" ~ '^[a-f0-9]{64}$');

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_sourceFileName_check"
CHECK ("sourceFileName" IS NULL OR char_length("sourceFileName") BETWEEN 1 AND 255);

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_sourceSheetName_check"
CHECK ("sourceSheetName" IS NULL OR char_length("sourceSheetName") BETWEEN 1 AND 100);

ALTER TABLE "BoqItem"
ADD CONSTRAINT "BoqItem_sortOrder_check"
CHECK ("sortOrder" >= 0);

ALTER TABLE "Material"
ADD CONSTRAINT "Material_normalizedCode_check"
CHECK (
  "normalizedCode" IS NULL OR
  "normalizedCode" = upper(trim(regexp_replace("normalizedCode", '[[:space:]]+', ' ', 'g')))
);

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Boq"
ADD CONSTRAINT "Boq_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_immutable_boq_item_change()
RETURNS trigger AS $$
DECLARE
  checked_boq_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    checked_boq_id := NEW."boqId";
  ELSE
    checked_boq_id := OLD."boqId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Boq"
    WHERE "id" = checked_boq_id
      AND "status" IN ('APPROVED', 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'Approved or superseded BoQ items are immutable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM "Boq"
      WHERE "id" = NEW."boqId"
        AND "status" IN ('APPROVED', 'SUPERSEDED')
    ) THEN
      RAISE EXCEPTION 'Approved or superseded BoQ items are immutable';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BoqItem_immutable_baseline_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "BoqItem"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_boq_item_change();

CREATE OR REPLACE FUNCTION enforce_material_boq_project()
RETURNS trigger AS $$
BEGIN
  IF NEW."boqItemId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "BoqItem" item
    JOIN "Boq" boq ON boq."id" = item."boqId"
    WHERE item."id" = NEW."boqItemId"
      AND boq."projectId" = NEW."projectId"
  ) THEN
    RAISE EXCEPTION 'Material and BoQ item must belong to the same project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Material_same_project_trigger"
BEFORE INSERT OR UPDATE OF "boqItemId", "projectId" ON "Material"
FOR EACH ROW EXECUTE FUNCTION enforce_material_boq_project();
