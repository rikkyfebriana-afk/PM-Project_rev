CREATE TABLE "Quotation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "value" DECIMAL(18,2) NOT NULL CHECK ("value" > 0),
  "issuedDate" DATE NOT NULL,
  "sentDate" DATE,
  "validUntil" DATE,
  "followUpDate" DATE,
  "pic" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SENT','NEGOTIATION','WON','REJECTED','EXPIRED')),
  "notes" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quotation_dates_check" CHECK (
    ("sentDate" IS NULL OR "sentDate" >= "issuedDate") AND
    ("validUntil" IS NULL OR "validUntil" >= "issuedDate") AND
    ("followUpDate" IS NULL OR "followUpDate" >= "issuedDate") AND
    ("status" NOT IN ('SENT','NEGOTIATION','WON') OR "sentDate" IS NOT NULL) AND
    ("status" <> 'DRAFT' OR "sentDate" IS NULL)
  )
);
CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");
CREATE INDEX "Quotation_status_followUpDate_idx" ON "Quotation"("status", "followUpDate");
ALTER TABLE "Project" ADD COLUMN "quotationId" TEXT;
CREATE INDEX "Project_quotationId_idx" ON "Project"("quotationId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Custom application sessions: access exclusively through authorized server actions.
ALTER TABLE "Quotation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Quotation" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Quotation" FROM authenticated;
  END IF;
END $$;
