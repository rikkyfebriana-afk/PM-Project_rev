import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { hash } from 'bcryptjs';

// An isolated in-memory fixture. Never connects to the configured application database.
const db = await PGlite.create();
const root = new URL('../prisma/migrations/', import.meta.url);
for (const dir of (await readdir(root, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort())
  await db.exec(await readFile(new URL(`${dir}/migration.sql`, root), 'utf8'));
const passwordHash = await hash('Local-Smoke-Only-2026!', 12);
for (const [id, role] of [
  ['smoke-admin', 'ADMIN'],
  ['smoke-pm', 'PROJECT_MANAGER'],
  ['smoke-viewer', 'VIEWER'],
])
  await db.query(
    `INSERT INTO "User" ("id","username","normalizedUsername","displayName","role","passwordHash","updatedAt") VALUES ($1,$1,$1,$1,$2::"UserRole",$3,now())`,
    [id, role, passwordHash],
  );
await db.exec(`INSERT INTO "Project" ("id","code","name","projectManagerId","poValue","budgetValue","forecastCost","actualCost","costOpeningBalance","updatedAt") VALUES ('smoke-p1','QA-001','Acceptance test project','smoke-pm',1000000,800000,750000,10000,10000,now()),('smoke-p2','QA-002','Restricted project',NULL,500000,400000,300000,0,0,now());
  INSERT INTO "ProjectMember" ("id","projectId","userId") VALUES ('smoke-member','smoke-p1','smoke-viewer');`);
const server = new PGLiteSocketServer({
  db,
  host: '127.0.0.1',
  port: 55432,
  maxConnections: 10,
});
await server.start();
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', '3001', '-H', '127.0.0.1'],
  {
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DEMO_MODE: 'false',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
      DIRECT_URL:
        'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
      SESSION_COOKIE_NAME: 'pcc_smoke',
      APP_URL: 'http://localhost:3001',
      AUTH_SECRET: 'local-smoke-test-secret-no-production-use',
      SUPABASE_URL: 'https://smoke-test.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'smoke-only-no-storage-connection',
    },
  },
);
console.log(
  'Isolated test application: http://localhost:3001; users smoke-admin / smoke-pm / smoke-viewer. Synthetic password: Local-Smoke-Only-2026!',
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  await server.stop();
  await db.close();
  process.exit(0);
}
process.stdin.on('data', (data) => {
  if (String(data).trim() === 'stop') void close();
});
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
child.on('exit', () => void close());
