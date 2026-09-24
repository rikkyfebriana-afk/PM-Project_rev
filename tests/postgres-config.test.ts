import assert from 'node:assert/strict';
import test from 'node:test';
import { postgresConfig, prismaMigrationUrl } from '../lib/postgres-config.ts';

test('missing or invalid deployment URLs do not crash client generation', () => {
  for (const url of ['', 'not-a-url']) {
    assert.equal(prismaMigrationUrl(url), url);
    assert.deepEqual(postgresConfig(url), { connectionString: url });
  }
});

test('Supabase connections enforce trusted TLS despite URL overrides', () => {
  const config = postgresConfig('postgresql://user:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=disable&sslrootcert=bad&uselibpqcompat=true');
  assert.equal(config.ssl?.rejectUnauthorized, true);
  assert.match(config.ssl!.ca, /BEGIN CERTIFICATE/);
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.equal(new URL(config.connectionString).searchParams.has('sslrootcert'), false);
});
test('local database configuration is unchanged', () => {
  const url = 'postgresql://postgres:postgres@localhost:5432/test';
  assert.deepEqual(postgresConfig(url), { connectionString: url });
  assert.equal(prismaMigrationUrl(url), url);
});
test('Prisma Supabase migrations use strict TLS and CA', () => {
  const url = new URL(prismaMigrationUrl('postgresql://user:secret@db.example.supabase.co/postgres'));
  assert.equal(url.searchParams.get('sslaccept'), 'strict');
  assert.equal(url.searchParams.get('sslmode'), 'require');
  assert.match(url.searchParams.get('sslcert')!, /supabase-ca.crt$/);
});
