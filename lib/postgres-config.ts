import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Public CA downloaded from the certificate link in Supabase Database Settings.
export function isSupabaseDatabase(host: string): boolean {
  return (
    host.endsWith('.pooler.supabase.com') ||
    /^db\.[a-z0-9]+\.supabase\.co$/.test(host)
  );
}

export function postgresConfig(connectionString: string) {
  const url = new URL(connectionString);
  if (!isSupabaseDatabase(url.hostname)) return { connectionString };
  // pg connection-string SSL parameters override the explicit SSL object.
  for (const key of [
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'ssl',
    'uselibpqcompat',
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.href,
    ssl: {
      ca: readFileSync(resolve(process.cwd(), 'certs/supabase-ca.crt'), 'utf8'),
      rejectUnauthorized: true,
    },
  };
}

export function prismaMigrationUrl(connectionString: string): string {
  const url = new URL(connectionString);
  if (!isSupabaseDatabase(url.hostname)) return connectionString;
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('sslaccept', 'strict');
  url.searchParams.set(
    'sslcert',
    resolve(process.cwd(), 'certs/supabase-ca.crt'),
  );
  return url.href;
}
