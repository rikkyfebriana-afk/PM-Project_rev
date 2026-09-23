-- Run after Prisma migrations on a dedicated Supabase project.
-- Business data is accessed through the authenticated Next.js server, not Data API.
-- No permissive anon/authenticated policies are intentionally created.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User', 'Session', 'Project', 'ProjectMember', 'Boq', 'BoqItem',
    'Material', 'Milestone', 'ActionItem', 'Document', 'AuditLog', 'CostEntry'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
  END LOOP;
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

ALTER FUNCTION public.prevent_immutable_boq_item_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_material_boq_project() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_action_milestone_project() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.prevent_immutable_boq_item_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_material_boq_project() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_action_milestone_project() FROM PUBLIC, anon, authenticated;

-- Prevent default Supabase grants from exposing future server-owned tables/functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
