-- Existing accounts remain unchanged until an administrator explicitly enables access.
ALTER TABLE "User" ADD COLUMN "viewerPortfolioAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "viewerAccessVersion" INTEGER NOT NULL DEFAULT 0 CHECK ("viewerAccessVersion">=0);
ALTER TABLE "ViewerPermission" DROP CONSTRAINT "ViewerPermission_scopes_check";
ALTER TABLE "ViewerPermission" ADD CONSTRAINT "ViewerPermission_scopes_check"
 CHECK ("scopes" <@ ARRAY['PROJECT','PO','FINANCE','BOQ','MATERIALS','DOCUMENTS','TIME_PLAN','TEAM_TARGETS','OPERATIONS']::TEXT[]);
