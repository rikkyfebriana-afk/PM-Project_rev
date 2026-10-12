CREATE TABLE "ViewerPermission" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("userId","projectId"),
 CHECK ("scopes" <@ ARRAY['PROJECT','PO','FINANCE','BOQ','DOCUMENTS','TIME_PLAN','TEAM_TARGETS','OPERATIONS']::TEXT[]),
 CHECK (cardinality("scopes")=0 OR 'PROJECT'=ANY("scopes")),
 CHECK (NOT ('FINANCE'=ANY("scopes")) OR 'PO'=ANY("scopes"))
);
CREATE INDEX "ViewerPermission_projectId_idx" ON "ViewerPermission"("projectId");
ALTER TABLE "ViewerPermission" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ViewerPermission" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ViewerPermission" FROM authenticated; END IF;
END $$;
