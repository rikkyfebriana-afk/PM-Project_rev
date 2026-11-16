BEGIN;

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "issueDate" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "sentDate" DATE,
  "amount" DECIMAL(18,2) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_number_check" CHECK (length(btrim("number")) > 0),
  CONSTRAINT "Invoice_description_check" CHECK (length(btrim("description")) > 0),
  CONSTRAINT "Invoice_amount_check" CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric),
  CONSTRAINT "Invoice_dates_check" CHECK ("dueDate" >= "issueDate" AND ("sentDate" IS NULL OR "sentDate" >= "issueDate")),
  CONSTRAINT "Invoice_void_check" CHECK (
    ("voidedAt" IS NULL AND "voidReason" = '') OR
    ("voidedAt" IS NOT NULL AND length(btrim("voidReason")) > 0)
  )
);

CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidDate" DATE NOT NULL,
  "reference" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoicePayment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoicePayment_amount_check" CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric),
  CONSTRAINT "InvoicePayment_void_check" CHECK (
    ("voidedAt" IS NULL AND "voidReason" = '') OR
    ("voidedAt" IS NOT NULL AND length(btrim("voidReason")) > 0)
  )
);

CREATE UNIQUE INDEX "Invoice_projectId_number_key" ON "Invoice"("projectId", "number");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE UNIQUE INDEX "InvoicePayment_requestId_key" ON "InvoicePayment"("requestId");
CREATE INDEX "InvoicePayment_invoiceId_paidDate_idx" ON "InvoicePayment"("invoiceId", "paidDate");
CREATE INDEX "InvoicePayment_actorId_idx" ON "InvoicePayment"("actorId");

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoicePayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Invoice", "InvoicePayment" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "Invoice", "InvoicePayment" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "Invoice", "InvoicePayment" FROM authenticated;
  END IF;
END $$;

COMMIT;
