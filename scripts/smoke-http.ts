import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import ExcelJS from 'exceljs';

// End-to-end requests against the isolated fixture, using the real server-rendered action forms.
const base = 'http://localhost:3001';
const server = spawn(process.execPath, ['scripts/smoke-server.ts'], {
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => {
  output += String(chunk);
});
server.stderr.on('data', (chunk) => {
  output += String(chunk);
});
const cookies = new Map<string, string>();
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...init,
    redirect: 'manual',
    headers: {
      ...init.headers,
      Origin: base,
      Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    },
  });
  for (const raw of response.headers.getSetCookie()) {
    const first = raw.split(';')[0];
    const equal = first.indexOf('=');
    cookies.set(first.slice(0, equal), first.slice(equal + 1));
  }
  return response;
}
const decode = (v: string) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
function forms(html: string) {
  return [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((match) => {
    const body = new FormData();
    for (const input of match[1].matchAll(/<input\b[^>]*>/g)) {
      const attrs = Object.fromEntries(
        [...input[0].matchAll(/([\w:$.-]+)="([^"]*)"/g)].map((a) => [
          a[1],
          decode(a[2]),
        ]),
      );
      if (attrs.type === 'hidden' && attrs.name)
        body.append(attrs.name, attrs.value ?? '');
    }
    return { html: match[1], body };
  });
}
async function form(
  path: string,
  marker: string,
  predicate: (data: FormData) => boolean = () => true,
) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} should load`);
  const html = await response.text();
  const selected = forms(html).find(
    (f) => f.html.includes(`name="${marker}"`) && predicate(f.body),
  );
  assert.ok(selected, `Form ${marker} not found on ${path}`);
  return selected.body;
}
async function post(
  path: string,
  body: FormData,
  values: Record<string, string>,
) {
  for (const [k, v] of Object.entries(values)) body.set(k, v);
  const response = await request(path, { method: 'POST', body });
  return { status: response.status, text: await response.text() };
}
async function login(username: string) {
  const body = await form('/login', 'username');
  const response = await post('/login', body, {
    username,
    password: 'Local-Smoke-Only-2026!',
  });
  assert.ok([200, 303].includes(response.status));
  const home = await request('/dashboard');
  assert.equal(home.status, 200);
  return home.text();
}

try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Test server not ready: ${output.slice(-2000)}`)),
      90000,
    );
    const interval = setInterval(() => {
      if (output.includes('Ready in')) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      } else if (server.exitCode !== null) {
        clearTimeout(timer);
        clearInterval(interval);
        reject(new Error(output));
      }
    }, 200);
  });
  const anonymous = await request('/api/reports?type=portfolio&format=xlsx');
  assert.equal(anonymous.status, 401);
  const home = await login('smoke-admin');
  assert.ok(home.includes('QA-001') && home.includes('QA-002'));
  console.log('PASS login and administrator portfolio scope');
  const production = await form(
    '/production',
    'plannedDate',
    (f) => !f.get('id'),
  );
  const values = {
    projectId: 'smoke-p1',
    phase: 'PRODUCTION',
    title: 'HTTP assembly verification',
    plannedDate: '2026-09-25',
    progressPct: '40',
    status: 'UPCOMING',
    notes: 'Local synthetic test',
    referenceNo: 'QA-REF',
    responsible: 'QA Operator',
  };
  const created = await post('/production', production, values);
  assert.ok(
    created.text.includes('Milestone operasional tersimpan'),
    created.text.slice(-1200),
  );
  let edit = await form('/production', 'plannedDate', (f) => !!f.get('id'));
  const milestoneId = String(edit.get('id'));
  const punch = await form(
    '/production',
    'dueAt',
    (f) => f.get('milestoneId') === milestoneId && !f.get('id'),
  );
  const punchValues = {
    projectId: 'smoke-p1',
    title: 'Verify terminal labels',
    description: 'Open QA finding',
    priority: 'HIGH',
    status: 'OPEN',
    dueAt: '2026-09-24',
  };
  const added = await post('/production', punch, punchValues);
  assert.ok(added.text.includes('Action item tersimpan'));
  const blocked = await post('/production', edit, {
    ...values,
    status: 'COMPLETED',
    progressPct: '100',
  });
  assert.ok(blocked.text.includes('Selesaikan seluruh punch list'));
  const resolve = await form('/actions', 'dueAt', (f) => !!f.get('id'));
  assert.ok(
    (
      await post('/actions', resolve, { ...punchValues, status: 'RESOLVED' })
    ).text.includes('Action item tersimpan'),
  );
  edit = await form('/production', 'plannedDate', (f) => !!f.get('id'));
  assert.ok(
    (
      await post('/production', edit, {
        ...values,
        status: 'COMPLETED',
        progressPct: '100',
      })
    ).text.includes('Milestone operasional tersimpan'),
  );
  console.log(
    'PASS production save, punch list gate, resolution, and completion',
  );
  const fat = await form('/fat', 'plannedDate', (f) => !f.get('id'));
  assert.ok(
    (
      await post('/fat', fat, {
        ...values,
        phase: 'FAT',
        status: 'COMPLETED',
        progressPct: '100',
      })
    ).text.includes('unggah dokumen pendukung'),
  );
  console.log('PASS FAT acceptance requires uploaded evidence');
  const finance = await form('/finance', 'requestId');
  const cost = {
    projectId: 'smoke-p1',
    category: 'MATERIAL',
    description: 'Synthetic panel cost',
    referenceNo: 'QA-INVOICE',
    amount: '2500.50',
    spentAt: '2026-09-20',
  };
  assert.ok(
    (await post('/finance', finance, cost)).text.includes('Biaya dicatat'),
  );
  assert.ok(
    (await post('/finance', finance, cost)).text.includes('Biaya dicatat'),
  );
  const ledger = await (
    await request('/api/reports?type=costs&format=xlsx&projectId=smoke-p1')
  ).arrayBuffer();
  assert.ok(ledger.byteLength > 1000);
  const ledgerBook = new ExcelJS.Workbook();
  await ledgerBook.xlsx.load(Buffer.from(ledger) as never);
  assert.equal(
    ledgerBook.worksheets[0].rowCount,
    5,
    'Duplicate retry must not create a second cost',
  );
  async function actualCost() {
    const res = await request(
      '/api/reports?type=portfolio&format=xlsx&projectId=smoke-p1',
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as never);
    return wb.worksheets[0].getCell('G5').value;
  }
  assert.equal(
    await actualCost(),
    12500.5,
    'Posting must update actual cost exactly once',
  );
  const voidForm = await form('/finance', 'reason');
  assert.ok(
    (
      await post('/finance', voidForm, { reason: 'Synthetic test correction' })
    ).text.includes('Biaya dibatalkan'),
  );
  assert.equal(
    await actualCost(),
    10000,
    'Voiding must restore opening balance',
  );
  console.log('PASS cost posting, idempotent retry, ledger export and void');
  for (const format of ['pdf', 'xlsx']) {
    const response = await request(
      `/api/reports?type=portfolio&format=${format}`,
    );
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  console.log('PASS authenticated PDF and Excel downloads');
  const adminBudget = await form('/finance', 'budgetValue');
  const viewerHome = await login('smoke-viewer');
  assert.ok(viewerHome.includes('QA-001'));
  assert.ok(!viewerHome.includes('QA-002'));
  assert.equal(
    (
      await request(
        '/api/reports?type=portfolio&format=xlsx&projectId=smoke-p2',
      )
    ).status,
    400,
  );
  const viewerWrite = await post('/production', production, values);
  assert.ok(viewerWrite.text.includes('Akses simpan tidak tersedia'));
  console.log(
    'PASS viewer project isolation, export denial and mutation denial',
  );
  await login('smoke-pm');
  const pmBudget = await post('/finance', adminBudget, {
    projectId: 'smoke-p1',
    poValue: '100',
    budgetValue: '100',
    forecastCost: '100',
  });
  assert.ok(pmBudget.text.includes('hanya untuk Admin'));
  console.log('PASS project manager cannot alter commercial baseline');
  console.log('All HTTP acceptance checks passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(output.slice(-3000));
  process.exitCode = 1;
} finally {
  server.stdin.write('stop\n');
  await Promise.race([
    once(server, 'exit'),
    new Promise((r) => setTimeout(r, 10000)),
  ]);
  if (server.exitCode === null) server.kill();
}
