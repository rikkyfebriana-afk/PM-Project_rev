import 'server-only';

import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !serviceRoleKey ||
    url.includes('example.supabase.co') ||
    serviceRoleKey === 'local-placeholder'
  ) {
    throw new Error('Supabase Storage is not configured.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
