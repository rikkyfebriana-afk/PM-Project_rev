ALTER TABLE "Project" ADD COLUMN "customerPoCompletedDate" DATE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_po_completion_date_check"
  CHECK ("customerPoCompletedDate" IS NULL OR
    ("customerPoStatus" = 'COMPLETED' AND "customerPoDate" IS NOT NULL AND "customerPoCompletedDate" >= "customerPoDate"));
-- Existing completed POs intentionally remain undated; never infer history from updatedAt.
