-- One customer PO lives on its project row: no second PO row or duplicate revenue.
ALTER TABLE "Project"
  ADD COLUMN "customerPoNumber" TEXT,
  ADD COLUMN "customerPoDate" DATE,
  ADD COLUMN "customerPoDescription" TEXT,
  ADD COLUMN "customerPoTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "customerPoDelivery" DATE,
  ADD COLUMN "customerPoStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "customerPoNotes" TEXT,
  ADD CONSTRAINT "Project_customer_po_tax_check" CHECK ("customerPoTax" >= 0),
  ADD CONSTRAINT "Project_customer_po_status_check" CHECK ("customerPoStatus" IN ('DRAFT','RECEIVED','IN_PROGRESS','COMPLETED','CANCELLED')),
  ADD CONSTRAINT "Project_customer_po_dates_check" CHECK ("customerPoDelivery" IS NULL OR "customerPoDate" IS NULL OR "customerPoDelivery" >= "customerPoDate");
