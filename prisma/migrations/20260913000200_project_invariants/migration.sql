ALTER TABLE "Project"
ADD CONSTRAINT "Project_coordinates_pair_check"
CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

ALTER TABLE "Project"
ADD CONSTRAINT "Project_schedule_check"
CHECK (
  "plannedStart" IS NULL
  OR "plannedFinish" IS NULL
  OR "plannedStart" <= "plannedFinish"
);

ALTER TABLE "Project"
ADD CONSTRAINT "Project_code_format_check"
CHECK (
  "code" = upper("code")
  AND "code" ~ '^[A-Z0-9][A-Z0-9._/-]*$'
);

ALTER TABLE "Project"
ADD CONSTRAINT "Project_closed_state_check"
CHECK (
  ("status" <> 'CLOSED' AND "phase" <> 'CLOSED')
  OR (
    "status" = 'CLOSED'
    AND "phase" = 'CLOSED'
    AND "progressPct" = 100
    AND "actualFinish" IS NOT NULL
  )
);
