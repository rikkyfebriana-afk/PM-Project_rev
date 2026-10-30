ALTER TABLE "Material" ADD COLUMN "warehouseIssuedQty" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "Material" ADD CONSTRAINT "Material_warehouse_quantity_check"
 CHECK ("warehouseIssuedQty">=0 AND "warehouseIssuedQty"<="receivedQty");
CREATE UNIQUE INDEX "Material_id_projectId_key" ON "Material"("id","projectId");

CREATE TABLE "WarehouseItem" (
 "id" TEXT PRIMARY KEY,
 "code" TEXT NOT NULL,
 "normalizedCode" TEXT NOT NULL UNIQUE,
 "description" TEXT NOT NULL,
 "unit" TEXT NOT NULL,
 "location" TEXT NOT NULL DEFAULT '',
 "minQty" DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK ("minQty">=0),
 "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK ("quantity">=0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK (length(trim("normalizedCode"))>0 AND length(trim("unit"))>0)
);
CREATE TABLE "WarehouseMovement" (
 "id" TEXT PRIMARY KEY,
 "requestId" TEXT NOT NULL UNIQUE,
 "payloadHash" TEXT NOT NULL,
 "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "type" TEXT NOT NULL CHECK ("type" IN ('RECEIPT','ISSUE','RETURN')),
 "quantity" DECIMAL(18,4) NOT NULL CHECK ("quantity">0),
 "balanceAfter" DECIMAL(18,4) NOT NULL CHECK ("balanceAfter">=0),
 "warehouseItemId" TEXT NOT NULL REFERENCES "WarehouseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "projectId" TEXT REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "materialId" TEXT,
 "boqItemId" TEXT REFERENCES "BoqItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "returnOfId" TEXT REFERENCES "WarehouseMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "referenceNo" TEXT NOT NULL CHECK (length(trim("referenceNo"))>0),
 "recipient" TEXT NOT NULL CHECK (length(trim("recipient"))>0),
 "notes" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("materialId","projectId") REFERENCES "Material"("id","projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK (("type"='RECEIPT' AND "projectId" IS NULL AND "materialId" IS NULL AND "boqItemId" IS NULL AND "returnOfId" IS NULL)
 OR ("type"='ISSUE' AND "projectId" IS NOT NULL AND "materialId" IS NOT NULL AND "boqItemId" IS NOT NULL AND "returnOfId" IS NULL)
 OR ("type"='RETURN' AND "projectId" IS NOT NULL AND "materialId" IS NOT NULL AND "boqItemId" IS NOT NULL AND "returnOfId" IS NOT NULL))
);
CREATE INDEX "WarehouseMovement_warehouseItemId_createdAt_idx" ON "WarehouseMovement"("warehouseItemId","createdAt");
CREATE INDEX "WarehouseMovement_projectId_createdAt_idx" ON "WarehouseMovement"("projectId","createdAt");
CREATE INDEX "WarehouseMovement_materialId_projectId_idx" ON "WarehouseMovement"("materialId","projectId");
CREATE INDEX "WarehouseMovement_boqItemId_idx" ON "WarehouseMovement"("boqItemId");
CREATE INDEX "WarehouseMovement_actorId_idx" ON "WarehouseMovement"("actorId");
CREATE INDEX "WarehouseMovement_returnOfId_idx" ON "WarehouseMovement"("returnOfId");

CREATE FUNCTION prevent_warehouse_movement_change() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 RAISE EXCEPTION 'Warehouse ledger is immutable; record a return instead';
END; $$;
CREATE TRIGGER "WarehouseMovement_immutable" BEFORE UPDATE OR DELETE ON "WarehouseMovement"
 FOR EACH ROW EXECUTE FUNCTION prevent_warehouse_movement_change();
REVOKE ALL ON FUNCTION prevent_warehouse_movement_change() FROM PUBLIC;
ALTER TABLE "WarehouseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WarehouseMovement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "WarehouseItem","WarehouseMovement" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON "WarehouseItem","WarehouseMovement" FROM anon;
  REVOKE ALL ON FUNCTION prevent_warehouse_movement_change() FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON "WarehouseItem","WarehouseMovement" FROM authenticated;
  REVOKE ALL ON FUNCTION prevent_warehouse_movement_change() FROM authenticated;
 END IF;
END $$;
