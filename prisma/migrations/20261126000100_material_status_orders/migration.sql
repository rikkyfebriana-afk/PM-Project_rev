-- AlterTable
ALTER TABLE "WarehouseMovement" ADD COLUMN     "materialOrderId" TEXT;

-- CreateTable
CREATE TABLE "MaterialOrder" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "warehouseItemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "referenceNo" TEXT NOT NULL DEFAULT '',
    "expectedArrival" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cancellationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialOrder_requestId_key" ON "MaterialOrder"("requestId");

-- CreateIndex
CREATE INDEX "MaterialOrder_warehouseItemId_createdAt_idx" ON "MaterialOrder"("warehouseItemId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialOrder_status_expectedArrival_idx" ON "MaterialOrder"("status", "expectedArrival");

-- CreateIndex
CREATE INDEX "MaterialOrder_createdById_idx" ON "MaterialOrder"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialOrder_id_warehouseItemId_key" ON "MaterialOrder"("id", "warehouseItemId");

-- CreateIndex
CREATE INDEX "WarehouseMovement_materialOrderId_idx" ON "WarehouseMovement"("materialOrderId");

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "WarehouseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_materialOrderId_warehouseItemId_fkey" FOREIGN KEY ("materialOrderId", "warehouseItemId") REFERENCES "MaterialOrder"("id", "warehouseItemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drafts reserve one replenishment workflow, but do not increase available stock.
CREATE UNIQUE INDEX "MaterialOrder_one_active_per_item_key"
 ON "MaterialOrder" ("warehouseItemId")
 WHERE "status" IN ('DRAFT', 'ORDERED', 'PARTIAL');

ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_quantity_check"
 CHECK ("quantity" > 0 AND "receivedQty" >= 0 AND "receivedQty" <= "quantity");
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_status_check"
 CHECK (("status" IN ('DRAFT', 'ORDERED') AND "receivedQty" = 0)
     OR ("status" = 'PARTIAL' AND "receivedQty" > 0 AND "receivedQty" < "quantity")
     OR ("status" = 'RECEIVED' AND "receivedQty" = "quantity")
     OR ("status" = 'CANCELLED' AND "receivedQty" < "quantity"));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_snapshot_check"
 CHECK (length(trim("itemCode")) > 0 AND length(trim("description")) > 0
    AND length(trim("unit")) > 0 AND length(trim("payloadHash")) > 0);
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_supplier_check"
 CHECK ("status" NOT IN ('ORDERED', 'PARTIAL', 'RECEIVED')
     OR (length(trim("supplier")) > 0 AND length(trim("referenceNo")) > 0));
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_cancellation_check"
 CHECK (("status" = 'CANCELLED' AND "cancellationReason" IS NOT NULL
         AND length(trim("cancellationReason")) > 0)
     OR ("status" <> 'CANCELLED' AND "cancellationReason" IS NULL));
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_order_receipt_check"
 CHECK ("materialOrderId" IS NULL OR "type" = 'RECEIPT');

-- Access remains through the authenticated application server, not the public Data API.
ALTER TABLE "MaterialOrder" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "MaterialOrder" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON "MaterialOrder" FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON "MaterialOrder" FROM authenticated;
 END IF;
END $$;
