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
  if (path === '/time-plan') path += '?projectId=smoke-p1';
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
  assert.equal((await request('/customer-po')).status, 307);
  assert.equal((await request('/time-plan')).status, 307);
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
  const poValues = {
    projectId: 'smoke-p1',
    customerPoNumber: 'QA-PO/001',
    clientName: 'Synthetic customer',
    customerPoDate: '2026-09-30',
    customerPoDelivery: '2026-10-15',
    customerPoDescription: 'Test panel delivery',
    poValue: '1200000.50',
    customerPoTax: '132000.05',
    customerPoStatus: 'RECEIVED',
    customerPoNotes: 'Isolated fixture only',
  };
  const poForm = await form(
    '/customer-po',
    'customerPoNumber',
    (f) => f.get('projectId') === 'smoke-p1',
  );
  assert.ok(
    (await post('/customer-po', poForm, poValues)).text.includes(
      'PO Customer tersimpan',
    ),
  );
  assert.ok(
    (
      await post('/customer-po', poForm, { ...poValues, poValue: '10' })
    ).text.includes('Data proyek sudah berubah'),
  );
  const updatedPo = await form(
    '/customer-po',
    'customerPoNumber',
    (f) => f.get('projectId') === 'smoke-p1',
  );
  assert.ok(
    (
      await post('/customer-po', updatedPo, {
        ...poValues,
        poValue: '1300000.50',
        customerPoStatus: 'IN_PROGRESS',
      })
    ).text.includes('PO Customer tersimpan'),
  );
  const poReport = await request(
    '/api/reports?type=portfolio&format=xlsx&projectId=smoke-p1',
  );
  const poBook = new ExcelJS.Workbook();
  await poBook.xlsx.load(Buffer.from(await poReport.arrayBuffer()) as never);
  assert.equal(
    poBook.worksheets[0].getCell('E5').value,
    1300000.5,
    'PO must replace value, not accumulate or include PPN',
  );
  const poPage = await (await request('/customer-po')).text();
  assert.ok(poPage.includes('PO dicatat') && poPage.includes('PO diperbarui'));
  const tamperedBudget = await form(
    '/finance',
    'budgetValue',
    (f) => f.get('projectId') === 'smoke-p1',
  );
  assert.ok(
    (
      await post('/finance', tamperedBudget, {
        projectId: 'smoke-p1',
        poValue: '1',
        budgetValue: '800000',
        forecastCost: '750000',
      })
    ).text.includes('Ubah nilai PO melalui menu PO Customer'),
  );
  console.log(
    'PASS PO create/update, stale write rejection, exact revenue, audit history and Finance guard',
  );
  const taskValues = {
    projectId: 'smoke-p1',
    id: '',
    phase: 'ENGINEERING',
    title: 'Engineering drawings',
    responsible: 'QA engineer',
    sortOrder: '1',
    weight: '20',
    progressPct: '50',
    plannedStart: '2026-09-01',
    plannedFinish: '2026-09-02',
    actualStart: '2026-09-01',
    actualFinish: '',
    predecessorId: '',
    notes: 'Isolated time plan fixture',
  };
  const taskNew = await form('/time-plan', 'weight', (f) => !f.get('id'));
  assert.equal(
    taskNew.get('projectId'),
    'smoke-p1',
    'Time Plan must select the requested fixture project',
  );
  const taskCreated = await post('/time-plan', taskNew, taskValues);
  assert.ok(
    taskCreated.text.includes('Pekerjaan tersimpan'),
    `Task save failed: ${taskCreated.text.match(/role="status"[^>]*>[\s\S]*?<\/[^>]+>/g)?.join(' ') || taskCreated.text.slice(-3000)}`,
  );
  let activatePlan = await form('/time-plan', 'active');
  assert.ok(
    (await post('/time-plan', activatePlan, { active: 'true' })).text.includes(
      'Total bobot harus tepat 100%',
    ),
  );
  const taskEdit = await form('/time-plan', 'weight', (f) => !!f.get('id'));
  const firstTaskId = String(taskEdit.get('id'));
  const taskTwo = {
    ...taskValues,
    id: '',
    phase: 'PRODUCTION',
    title: 'Assembly panel',
    sortOrder: '2',
    weight: '80',
    progressPct: '0',
    plannedStart: '2026-09-03',
    plannedFinish: '2026-09-05',
    actualStart: '',
    predecessorId: firstTaskId,
  };
  assert.ok(
    (
      await post(
        '/time-plan',
        await form('/time-plan', 'weight', (f) => !f.get('id')),
        taskTwo,
      )
    ).text.includes('Pekerjaan tersimpan'),
  );
  activatePlan = await form('/time-plan', 'active');
  assert.ok(
    (await post('/time-plan', activatePlan, { active: 'true' })).text.includes(
      'Time Plan aktif',
    ),
  );
  async function reportProgress() {
    const response = await request(
      '/api/reports?type=portfolio&format=xlsx&projectId=smoke-p1',
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
    return wb.worksheets[0].getCell('D5').value;
  }
  assert.equal(await reportProgress(), 10);
  assert.ok(
    (
      await post('/time-plan', taskEdit, { ...taskValues, id: firstTaskId })
    ).text.includes('sudah berubah'),
  );
  const currentFirst = await form(
    '/time-plan',
    'weight',
    (f) => f.get('id') === firstTaskId,
  );
  assert.ok(
    (
      await post('/time-plan', currentFirst, {
        ...taskValues,
        id: firstTaskId,
        weight: '10',
      })
    ).text.includes('Bobot rencana aktif harus tetap 100%'),
  );
  assert.ok(
    (
      await post('/time-plan', currentFirst, {
        ...taskValues,
        id: firstTaskId,
        progressPct: '100',
        actualFinish: '2026-09-02',
      })
    ).text.includes('Pekerjaan tersimpan'),
  );
  const secondEdit = await form(
    '/time-plan',
    'weight',
    (f) => !!f.get('id') && f.get('id') !== firstTaskId,
  );
  const secondTaskId = String(secondEdit.get('id'));
  const secondUpdate = {
    ...taskTwo,
    id: secondTaskId,
    progressPct: '50',
    actualStart: '2026-09-03',
  };
  assert.ok(
    (await post('/time-plan', secondEdit, secondUpdate)).text.includes(
      'Pekerjaan tersimpan',
    ),
  );
  assert.equal(await reportProgress(), 60);
  // Locate archive via its submit label rather than hidden identity alone.
  const planHtml = await (await request('/time-plan')).text();
  assert.ok(
    planHtml.includes('Display Weeks') &&
      planHtml.includes('QA-PO/001') &&
      planHtml.includes('Lembar Time Plan'),
  );
  const allPlanHtml = await (await request('/time-plan?view=all')).text();
  assert.ok(
    allPlanHtml.includes('Semua proyek') &&
      allPlanHtml.includes('QA-001') &&
      allPlanHtml.includes('QA-002'),
  );
  const archiveBody = forms(planHtml).find(
    (f) =>
      f.html.includes('Konfirmasi arsip') && f.body.get('id') === firstTaskId,
  )?.body;
  assert.ok(archiveBody);
  assert.ok(
    (await post('/time-plan', archiveBody, {})).text.includes(
      'Nonaktifkan acuan progres',
    ),
  );
  const planActivation = await form('/time-plan', 'active');
  const planReplay = await form(
    '/time-plan',
    'weight',
    (f) => f.get('id') === secondTaskId,
  );
  console.log(
    'PASS weighted Time Plan create, exact activation, stale writes, predecessor completion and 60% project rollup',
  );
  const adminBudget = await form('/finance', 'budgetValue');
  const viewerHome = await login('smoke-viewer');
  assert.ok(
    (await post('/time-plan', planReplay, secondUpdate)).text.includes(
      'Akses ubah Time Plan ditolak',
    ),
  );
  const viewerPlan = await (await request('/time-plan')).text();
  const viewerAllPlan = await (await request('/time-plan?view=all')).text();
  assert.ok(
    viewerAllPlan.includes('QA-001') && !viewerAllPlan.includes('QA-002'),
  );
  assert.ok(viewerPlan.includes('QA-001') && !viewerPlan.includes('QA-002'));
  const viewerPo = await (await request('/customer-po')).text();
  assert.ok(viewerPo.includes('QA-001') && !viewerPo.includes('QA-002'));
  assert.ok(
    (await post('/customer-po', updatedPo, poValues)).text.includes(
      'Hanya administrator',
    ),
  );
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
  assert.ok(
    (
      await post('/time-plan', planActivation, { active: 'false' })
    ).text.includes('Hanya administrator'),
  );
  const pmPlan = await form(
    '/time-plan',
    'weight',
    (f) => f.get('id') === secondTaskId,
  );
  assert.ok(
    (
      await post('/time-plan', pmPlan, {
        ...secondUpdate,
        projectId: 'smoke-p2',
      })
    ).text.includes('akses edit ditolak'),
  );
  assert.ok(
    (
      await post('/time-plan', pmPlan, { ...secondUpdate, progressPct: '75' })
    ).text.includes('Pekerjaan tersimpan'),
  );
  assert.equal(await reportProgress(), 80);
  assert.ok(
    (await post('/customer-po', updatedPo, poValues)).text.includes(
      'Hanya administrator',
    ),
  );
  assert.equal(
    (
      await request('/api/documents/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 'smoke-p1',
          category: 'PURCHASE_ORDER',
          fileName: 'po.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        }),
      })
    ).status,
    403,
  );
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
  console.error(error instanceof Error ? error.stack : error);
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
