import { config } from 'dotenv';
import pg from 'pg';
import { postgresConfig } from '../lib/postgres-config.ts';
import { createClient } from '@supabase/supabase-js';
config({ quiet: true });
const invalid = /(replace|your[_-]|example|placeholder|demo|USER:PASSWORD)/i;
const checks: { name: string; ok: boolean }[] = [];
function add(name: string, ok: boolean) {
  checks.push({ name, ok });
  console.log(`${ok ? 'OK' : 'MISSING'} ${name}`);
}
function url(name: string, protocols: string[]) {
  try {
    const value = process.env[name] ?? '';
    const parsed = new URL(value);
    return (
      !invalid.test(value) &&
      protocols.includes(parsed.protocol) &&
      !['localhost', '127.0.0.1'].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}
add('DATABASE_URL', url('DATABASE_URL', ['postgres:', 'postgresql:']));
add('DIRECT_URL', url('DIRECT_URL', ['postgres:', 'postgresql:']));
add('SUPABASE_URL', url('SUPABASE_URL', ['https:']));
add(
  'SUPABASE_SERVICE_ROLE_KEY',
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !invalid.test(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.length >= 30,
);
add(
  'AUTH_SECRET',
  (process.env.AUTH_SECRET?.length ?? 0) >= 32 &&
    !invalid.test(process.env.AUTH_SECRET ?? ''),
);
add('APP_URL (HTTPS production URL)', url('APP_URL', ['https:']));
add('SUPABASE_STORAGE_BUCKET', !!process.env.SUPABASE_STORAGE_BUCKET);
add(
  'SESSION_COOKIE_NAME',
  !process.env.SESSION_COOKIE_NAME ||
    process.env.SESSION_COOKIE_NAME.startsWith('__Host-'),
);
if (process.argv.includes('--live') && checks.every((c) => c.ok)) {
  const pool = new pg.Pool({
    ...postgresConfig(process.env.DATABASE_URL!),
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    await pool.query('SELECT 1');
    add('PostgreSQL connection', true);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    add('Database migrations applied', result.rows[0].count >= 4);
  } catch {
    add('PostgreSQL connection / migrations', false);
  } finally {
    await pool.end();
  }
  try {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await client.storage.getBucket(
      process.env.SUPABASE_STORAGE_BUCKET!,
    );
    add('Private storage bucket', !error && !!data && !data.public);
  } catch {
    add('Private storage bucket', false);
  }
}
console.log('Secret values are never printed by this check.');
if (checks.some((c) => !c.ok)) process.exitCode = 1;
