import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import pg from 'pg';

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

async function fixtureMembershipCount(userId:string,projectIds:string[]) {
  const client=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'});
  await client.connect();
  try{return Number((await client.query(`SELECT count(*) AS count FROM "ProjectMember" WHERE "userId"=$1 AND "projectId"=ANY($2::text[])`,[userId,projectIds])).rows[0].count);}
  finally{await client.end();}
}

// Project editor forms mount on click. Reuse the generated action-state encoding
// with the real compiled action ID to exercise the same server boundary over HTTP.
async function compiledActionId(exportedName:string,filename:string) {
  const manifest=JSON.parse(await readFile(new URL('../.next/server/server-reference-manifest.json',import.meta.url),'utf8'));
  const action=Object.entries(manifest.node).find(([,value])=>{
    const entry=value as {exportedName?:string;filename?:string};
    const source=entry.filename?.replaceAll('\\','/');
    return entry.exportedName===exportedName&&(source===filename||source?.endsWith(`/${filename}`));
  });
  assert.ok(action,`Compiled action ${exportedName} is missing`);
  return action[0];
}
async function actionStateForm(exportedName:string,filename:string) {
  const actionId=await compiledActionId(exportedName,filename);
  const body=await form('/settings','projectIds');
  let replaced=false;
  for(const [key,value] of body){
    if(typeof value!=='string'||!key.startsWith('$ACTION_'))continue;
    try{const encoded=JSON.parse(value);if(encoded&&typeof encoded.id==='string'&&'bound' in encoded){encoded.id=actionId;body.set(key,JSON.stringify(encoded));replaced=true;}}catch{}
  }
  assert.ok(replaced,'Action-state metadata was not found');
  return body;
}
async function projectActionForm(exportedName:string) {
  return actionStateForm(exportedName,'app/actions/projects.ts');
}
async function approveViaHttp(input:{boqId:string;expectedApprovedBoqId:string|null}) {
  const id=await compiledActionId('approveBoqRevisionAction','app/actions/boq.ts');
  const response=await request('/boq',{method:'POST',headers:{'Next-Action':id,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify([input])});
  assert.equal(response.status,200);
  return response.text();
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
  assert.equal((await request('/invoices')).status, 307);
  assert.equal((await request('/time-plan')).status, 307);
  assert.equal((await request('/quotations')).status, 307);
  assert.equal((await request('/team-targets')).status, 307);
  assert.equal((await request('/warehouse')).status, 307);
  const home = await login('smoke-admin');
  assert.ok(home.includes('QA-001') && home.includes('QA-002'));
  console.log('PASS login and administrator portfolio scope');
  const membership=await form('/settings','projectIds');
  membership.append('projectIds','smoke-p1');
  membership.append('projectIds','smoke-p2');
  assert.ok((await post('/settings',membership,{userId:'smoke-member-target',operation:'add'})).text.includes('2 proyek berhasil ditambahkan'));
  assert.ok((await post('/settings',membership,{})).text.includes('2 proyek berhasil ditambahkan'));
  assert.equal(await fixtureMembershipCount('smoke-member-target',['smoke-p1','smoke-p2']),2);
  const fullPmHome=await login('smoke-pm');
  assert.ok(fullPmHome.includes('QA-001')&&fullPmHome.includes('QA-002'));
  assert.ok((await post('/settings',membership,{})).text.includes('2 proyek berhasil ditambahkan'));
  await login('smoke-viewer');
  assert.ok((await post('/settings',membership,{})).text.includes('Akses anggota hanya dapat diatur Admin'));
  await login('smoke-pm');
  assert.ok((await post('/settings',membership,{operation:'remove'})).text.includes('centang konfirmasi pencabutan'));
  assert.equal(await fixtureMembershipCount('smoke-member-target',['smoke-p1','smoke-p2']),2);
  assert.ok((await post('/settings',membership,{confirmBulkRemove:'yes'})).text.includes('2 proyek berhasil dicabut'));
  assert.equal(await fixtureMembershipCount('smoke-member-target',['smoke-p1','smoke-p2']),0);
  membership.append('projectIds','missing-project');
  assert.ok((await post('/settings',membership,{operation:'add'})).text.includes('Ada proyek yang sudah diarsipkan atau tidak ditemukan'));
  assert.equal(await fixtureMembershipCount('smoke-member-target',['smoke-p1','smoke-p2']),0);
  membership.delete('projectIds');
  assert.ok((await post('/settings',membership,{})).text.includes('Pilih proyek dan pengguna'));
  await login('smoke-admin');
  console.log('PASS Admin and PM multi-project membership, duplicate retry, Viewer denial, removal confirmation and atomic invalid-project rejection');
  const overviewHome=await(await request('/dashboard')).text();
  for(const label of ['Pantauan seluruh modul','PO Customer — jumlah','Target Tim hari ini','Quotation / SPH','Time Plan','Dokumen']) assert.ok(overviewHome.includes(label),`Dashboard summary missing: ${label}`);
  for (const category of ['active','on-track','attention','critical','closed','material-shortage','delayed','fat-punch-list','budget-risk']) {
    assert.ok(home.includes(`/dashboard/sites?category=${category}`));
    const response = await request(`/dashboard/sites?category=${category}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    if (['active','on-track'].includes(category)) assert.ok(html.includes('QA-001') && html.includes('QA-002'));
    else assert.ok(html.includes('Tidak ada site/proyek pada kategori'));
  }
  assert.equal((await request('/dashboard/sites?category=invalid')).status,404);
  console.log('PASS dashboard category links, matching project lists, empty categories and invalid category');
  const teamPath='/team-targets?week=2026-10-05';
  const dailyValues={projectId:'smoke-p1',title:'QA daily assembly',pic:'Budi without account',scheduledDate:'2026-10-05',targetQty:'17',actualQty:'12',unit:'unit',priority:'HIGH',status:'IN_PROGRESS',notes:''};
  const newDaily=await form(teamPath,'targetQty',f=>!f.get('id'));
  assert.ok((await post(teamPath,newDaily,dailyValues)).text.includes('Target harian tersimpan'));
  assert.ok((await post(teamPath,newDaily,dailyValues)).text.includes('Tidak dibuat aktivitas ganda'));
  const editDaily=await form(teamPath,'targetQty',f=>!!f.get('id'));
  const dailyId=String(editDaily.get('id'));
  assert.ok((await post(teamPath,editDaily,{...dailyValues,scheduledDate:'2026-10-06'})).text.includes('Isi alasan perubahan jadwal'));
  assert.ok((await post(teamPath,editDaily,{...dailyValues,scheduledDate:'2026-10-06',rescheduleReason:'Material tiba besok'})).text.includes('Target harian tersimpan'));
  assert.ok((await post(teamPath,editDaily,dailyValues)).text.includes('Aktivitas sudah berubah'));
  assert.ok((await (await request(teamPath)).text()).includes('Material tiba besok'));
  const dailyDone=await form(teamPath,'confirm',f=>f.get('id')===dailyId);
  assert.ok((await post(teamPath,dailyDone,{confirm:'yes'})).text.includes('Aktivitas selesai'));
  const dailyReopen=await form(teamPath,'targetQty',f=>f.get('id')===dailyId);
  assert.ok((await post(teamPath,dailyReopen,{...dailyValues,status:'BLOCKED',notes:'Material belum tiba',scheduledDate:'2026-09-28',rescheduleReason:'Koreksi tanggal awal'})).text.includes('Target harian tersimpan'));
  const dailyReplay=await form(teamPath,'targetQty',f=>f.get('id')===dailyId);
  const generalDaily=await form(teamPath,'targetQty',f=>!f.get('id'));
  assert.ok((await post(teamPath,generalDaily,{...dailyValues,projectId:'',title:'QA internal private task'})).text.includes('Target harian tersimpan'));
  console.log('PASS free-text PIC, exact daily targets, duplicate retry, completion, rescheduling audit, backlog and general activities');
  const production = await form(
    '/production',
    'plannedDate',
    (f) => !f.get('id'),
  );
  const manualBoqForm = await form('/boq', 'manualRows');
  const manualItems = [
    {
      itemNo: '1',
      itemCode: 'QA-MANUAL-01',
      itemType: 'MATERIAL',
      description: 'Manual panel',
      unit: 'PCS',
      quantity: '2.5',
      unitPrice: '100.25',
    },
    {
      itemNo: '2',
      itemCode: '',
      itemType: 'SERVICE',
      description: 'Installation service',
      unit: 'LOT',
      quantity: '1',
      unitPrice: '50',
    },
  ];
  const manualValues = {
    projectId: 'smoke-p1',
    manualRows: JSON.stringify(manualItems),
    confirm: 'yes',
  };
  assert.ok(
    (
      await post('/boq', manualBoqForm, {
        ...manualValues,
        manualRows: JSON.stringify([manualItems[0], manualItems[0]]),
      })
    ).text.includes('duplikat'),
  );
  assert.ok(
    (await post('/boq', manualBoqForm, manualValues)).text.includes(
      'BoQ manual versi 1 tersimpan',
    ),
  );
  assert.ok(
    (await post('/boq', manualBoqForm, manualValues)).text.includes(
      'Tidak dibuat duplikat',
    ),
  );
  const revisedManual = {
    ...manualValues,
    manualRows: JSON.stringify(
      manualItems.map((r) => ({ ...r, unitPrice: '200' })),
    ),
  };
  assert.ok(
    (await post('/boq', manualBoqForm, revisedManual)).text.includes(
      'Revisi BoQ sudah berubah',
    ),
  );
  assert.ok(
    (
      await post('/boq', await form('/boq', 'manualRows'), revisedManual)
    ).text.includes('BoQ manual versi 2 tersimpan'),
  );
  const manualReplay = await form('/boq', 'manualRows');
  console.log(
    'PASS manual BoQ material/service draft, duplicate retry and stale revision protection',
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
  const financePoPage = await (await request('/finance')).text();
  assert.ok(financePoPage.includes('Nilai berdasarkan status PO Customer'));
  assert.ok(
    financePoPage.includes('Rp 1.300.000,50') &&
      financePoPage.includes('In Progress') &&
      financePoPage.includes('QA-PO/001'),
  );
  assert.ok(poPage.includes('PO dicatat') && poPage.includes('PO diperbarui'));
  const completionForm = await form(
    '/customer-po',
    'customerPoNumber',
    (f) => f.get('projectId') === 'smoke-p1',
  );
  const completionValues = {
    ...poValues,
    poValue: '1300000.50',
    customerPoStatus: 'COMPLETED',
    customerPoCompletedDate: '2026-10-01',
  };
  assert.ok(
    (
      await post('/customer-po', completionForm, {
        ...completionValues,
        customerPoCompletedDate: '',
      })
    ).text.includes('Isi tanggal selesai PO'),
  );
  assert.ok(
    (
      await post('/customer-po', completionForm, {
        ...completionValues,
        customerPoCompletedDate: '2099-01-01',
      })
    ).text.includes('tidak boleh di masa depan'),
  );
  assert.ok(
    (
      await post('/customer-po', completionForm, completionValues)
    ).text.includes('PO Customer tersimpan'),
  );
  const monthlyDashboard = await (await request('/dashboard')).text();
  assert.ok(
    monthlyDashboard.includes('Rp 1.800.000,50'),
    'Dashboard must show full active PO value without abbreviation',
  );
  assert.ok(
    monthlyDashboard.includes('Grafik PO bulanan') &&
      monthlyDashboard.includes('PO Selesai 1'),
  );
  assert.ok(
    (
      await post(
        '/customer-po',
        await form(
          '/customer-po',
          'customerPoNumber',
          (f) => f.get('projectId') === 'smoke-p1',
        ),
        {
          ...completionValues,
          customerPoStatus: 'IN_PROGRESS',
          customerPoCompletedDate: '',
        },
      )
    ).text.includes('PO Customer tersimpan'),
  );
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
  const invoiceFixtureDb = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
  });
  await invoiceFixtureDb.connect();
  try {
    await invoiceFixtureDb.query(`
      INSERT INTO "Project" (
        "id", "code", "name", "clientName", "status", "phase", "progressPct", "actualFinish",
        "customerPoNumber", "customerPoStatus", "customerPoDate", "customerPoCompletedDate", "deletedAt", "updatedAt"
      ) VALUES
        ('invoice-completed', 'QA-INV-CLOSED', 'Completed invoice project with full name', 'Synthetic invoice customer', 'CLOSED', 'CLOSED', 100, '2025-01-03', 'QA-PO/INV-CLOSED', 'COMPLETED', '2025-01-01', '2025-01-03', NULL, now()),
        ('invoice-active', 'QA-INV-ACTIVE', 'Active project with completed PO', 'Synthetic invoice customer', 'ACTIVE', 'PLANNING', 50, NULL, 'QA-PO/INV-ACTIVE', 'COMPLETED', '2025-01-01', '2025-01-03', NULL, now()),
        ('invoice-po-open', 'QA-INV-OPEN', 'Closed project with received PO', 'Synthetic invoice customer', 'CLOSED', 'CLOSED', 100, '2025-01-03', 'QA-PO/INV-OPEN', 'RECEIVED', '2025-01-01', NULL, NULL, now()),
        ('invoice-po-progress', 'QA-INV-PROGRESS', 'Closed project with in-progress PO', 'Synthetic invoice customer', 'CLOSED', 'CLOSED', 100, '2025-01-03', 'QA-PO/INV-PROGRESS', 'IN_PROGRESS', '2025-01-01', NULL, NULL, now()),
        ('invoice-missing-po', 'QA-INV-MISSING', 'Completed project without PO number', 'Synthetic invoice customer', 'CLOSED', 'CLOSED', 100, '2025-01-03', NULL, 'COMPLETED', '2025-01-01', '2025-01-03', NULL, now()),
        ('invoice-archived', 'QA-INV-ARCHIVED', 'Archived completed invoice project', 'Synthetic invoice customer', 'CLOSED', 'CLOSED', 100, '2025-01-03', 'QA-PO/INV-ARCHIVED', 'COMPLETED', '2025-01-01', '2025-01-03', now(), now())
    `);
  } finally {
    await invoiceFixtureDb.end();
  }
  const invoicePath = '/invoices';
  const invoiceBase = {
    projectId: 'invoice-completed',
    number: 'QA-INV/001',
    description: 'QA invoice first milestone',
    issueDate: '2026-09-30',
    dueDate: '2099-10-01',
    sentDate: '',
    amount: '100000.50',
    notes: 'Isolated test only',
  };
  const createInvoiceForm = () => form(invoicePath, 'number', (fields) => !fields.get('invoiceId'));
  const invoiceChoices = await (await request(invoicePath)).text();
  const createInvoiceHtml = forms(invoiceChoices).find((entry) =>
    entry.html.includes('name="number"') && !entry.body.get('invoiceId'),
  )?.html;
  assert.ok(createInvoiceHtml);
  assert.ok(createInvoiceHtml.includes('value="invoice-completed"'));
  assert.ok(createInvoiceHtml.includes('Completed invoice project with full name'));
  const ineligibleInvoiceProjects = [
    'invoice-active', 'invoice-po-open', 'invoice-po-progress', 'invoice-missing-po', 'invoice-archived', 'smoke-p1', 'smoke-p2',
  ];
  for (const projectId of ineligibleInvoiceProjects) {
    assert.ok(!createInvoiceHtml.includes(`value="${projectId}"`), `${projectId} must not be offered for new invoices`);
    const result = await post(invoicePath, await createInvoiceForm(), {
      ...invoiceBase, projectId, number: `QA-INV/INELIGIBLE/${projectId}`,
    });
    assert.ok(!result.text.includes('Invoice tersimpan'), `${projectId} must reject a tampered invoice submission`);
  }
  const adminCreateInvoice = await createInvoiceForm();
  assert.ok((await post(invoicePath, adminCreateInvoice, invoiceBase)).text.includes('Invoice tersimpan'));
  assert.ok(!(await post(invoicePath, await createInvoiceForm(), {
    ...invoiceBase, number: ' qa-inv/001 ',
  })).text.includes('Invoice tersimpan'));

  await login('smoke-pm');
  assert.ok((await post(invoicePath, await createInvoiceForm(), {
    ...invoiceBase,
    number: 'QA-INV/002',
    issueDate: '2025-01-01',
    dueDate: '2025-01-05',
    sentDate: '2025-01-02',
    amount: '200000.25',
  })).text.includes('Invoice tersimpan'));

  function renderedInvoiceRows(html: string) {
    return [...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)]
      .filter((row) => row[1].includes('data-invoice-status='));
  }

  async function renderedInvoiceId(status: string, number: string) {
    const page = await request(invoicePath);
    assert.equal(page.status, 200);
    const row = renderedInvoiceRows(await page.text())
      .find((match) => match[1].includes(`data-invoice-status="${status}"`) && match[2].includes(number));
    const id = row?.[1].match(/data-invoice-id="([^"]+)"/)?.[1];
    assert.ok(id, `Invoice ${number} should be ${status}`);
    return id;
  }

  function dashboardInvoiceCard(html: string, kind: 'total' | 'count', key: string) {
    const marker = `data-invoice-${kind}="${key}"`;
    const card = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
      .find((match) => match[1].includes(marker));
    assert.ok(card, `Dashboard invoice summary is missing ${marker}`);
    return card;
  }

  function assertDashboardInvoices(
    html: string,
    totals: Record<string, string>,
    counts: Record<string, number>,
  ) {
    assert.ok(html.includes('aria-labelledby="invoice-summary-heading"'));
    for (const [key, expected] of Object.entries(totals)) {
      const [, , body] = dashboardInvoiceCard(html, 'total', key);
      assert.ok(body.includes(`>${expected}</p>`), `Dashboard ${key} should be ${expected}`);
    }
    for (const [key, expected] of Object.entries(counts)) {
      const [, attributes, body] = dashboardInvoiceCard(html, 'count', key);
      assert.ok(body.includes(`>${expected}</p>`), `Dashboard ${key} should count ${expected} invoices`);
      assert.ok(attributes.includes(`href="${invoicePath}?status=${key}"`));
    }
  }
  const invoiceId = await renderedInvoiceId('DRAFT', invoiceBase.number);
  const invoiceNameRow = renderedInvoiceRows(await (await request(invoicePath)).text())
    .find((row) => row[1].includes(`data-invoice-id="${invoiceId}"`));
  assert.ok(invoiceNameRow?.[2].includes('Completed invoice project with full name'));
  assert.notEqual(await renderedInvoiceId('OVERDUE', 'QA-INV/002'), invoiceId);
  const editInvoice = () => form(invoicePath, 'number', (fields) => fields.get('invoiceId') === invoiceId);
  const send = { ...invoiceBase, sentDate: '2026-09-30' };
  assert.ok((await post(invoicePath, await editInvoice(), send)).text.includes('Invoice tersimpan'));
  await renderedInvoiceId('SENT', invoiceBase.number);
  const reopenedInvoiceDb = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
  });
  await reopenedInvoiceDb.connect();
  try {
    await reopenedInvoiceDb.query(`
      UPDATE "Project" SET status='ACTIVE', phase='PLANNING', "progressPct"=50, "actualFinish"=NULL, "updatedAt"=now()
      WHERE id='invoice-completed'
    `);
  } finally {
    await reopenedInvoiceDb.end();
  }
  assert.ok(!(await post(invoicePath, adminCreateInvoice, {
    ...invoiceBase, number: 'QA-INV/REOPENED',
  })).text.includes('Invoice tersimpan'));
  // Previously recorded invoices remain available for payment and correction.
  await renderedInvoiceId('SENT', invoiceBase.number);
  const staleInvoiceForm = await editInvoice();
  const paymentForm = () => form(invoicePath, 'paidDate', (fields) => fields.get('invoiceId') === invoiceId);
  const firstPayment = await paymentForm();
  const payment = { amount: '40000.20', paidDate: '2026-10-01', reference: 'QA-INV-PAY/001', notes: '' };
  assert.ok((await post(invoicePath, firstPayment, payment)).text.includes('Pembayaran tercatat'));
  assert.ok((await post(invoicePath, firstPayment, { ...payment, amount: '40000.2' })).text.includes('Pembayaran sudah tercatat'));
  assert.ok(!(await post(invoicePath, firstPayment, { ...payment, amount: '40000.21' })).text.includes('Pembayaran tercatat'));
  await renderedInvoiceId('PARTIAL', invoiceBase.number);
  const paymentDashboard = await request('/dashboard');
  assert.equal(paymentDashboard.status, 200);
  const partialDashboard = await paymentDashboard.text();
  assertDashboardInvoices(
    partialDashboard,
    { billed: 'Rp 300.000,75', paid: 'Rp 40.000,20', balance: 'Rp 260.000,55', overdue: 'Rp 200.000,25' },
    { DRAFT: 0, SENT: 0, PARTIAL: 1, PAID: 0, OVERDUE: 1, VOID: 0 },
  );
  const [, overdueAttributes] = dashboardInvoiceCard(partialDashboard, 'count', 'OVERDUE');
  const overdueLink = overdueAttributes.match(/href="([^"]+)"/)?.[1];
  assert.ok(overdueLink);
  const overduePage = await request(overdueLink);
  assert.equal(overduePage.status, 200);
  const overdueRows = renderedInvoiceRows(await overduePage.text());
  assert.equal(overdueRows.length, 1);
  assert.ok(overdueRows[0][1].includes('data-invoice-status="OVERDUE"'));
  assert.ok(overdueRows[0][2].includes('QA-INV/002'));
  assert.ok(!(await post(invoicePath, staleInvoiceForm, send)).text.includes('Invoice tersimpan'));
  assert.ok(!(await post(invoicePath, await editInvoice(), { ...send, amount: '40000.19' })).text.includes('Invoice tersimpan'));

  // Either half of the race fits on its own, but posting both would overpay.
  const racingForms = await Promise.all([paymentForm(), paymentForm()]);
  const racingPayments = await Promise.all(racingForms.map((fields, index) =>
    post(invoicePath, fields, {
      ...payment, requestId: randomUUID(), amount: '60000.30', reference: `QA-INV-RACE/${index}`,
    }),
  ));
  assert.equal(racingPayments.filter((response) => response.text.includes('Pembayaran tercatat')).length, 1);
  await renderedInvoiceId('PAID', invoiceBase.number);

  const voidInvoiceForm = () => form(invoicePath, 'reason', (fields) =>
    fields.get('invoiceId') === invoiceId && !fields.get('paymentId'),
  );
  // The server must enforce this even when the UI omits the button for paid invoices.
  const blockedVoid = await actionStateForm('voidInvoice', 'app/actions/invoices.ts');
  assert.ok(!(await post(invoicePath, blockedVoid, {
    invoiceId, updatedAt: String((await editInvoice()).get('updatedAt')), reason: 'QA cannot void with active payments',
  })).text.includes('Invoice dibatalkan'));
  for (let index = 0; index < 2; index++) {
    const voidPayment = await form(invoicePath, 'reason', (fields) =>
      fields.get('invoiceId') === invoiceId && !!fields.get('paymentId'),
    );
    assert.ok((await post(invoicePath, voidPayment, { reason: 'QA reverse incorrect payment' })).text.includes('Pembayaran dibatalkan'));
  }
  await renderedInvoiceId('SENT', invoiceBase.number);
  assert.ok((await post(invoicePath, await voidInvoiceForm(), { reason: 'QA cancel unused invoice' })).text.includes('Invoice dibatalkan'));
  await renderedInvoiceId('VOID', invoiceBase.number);

  const viewerInvoiceDashboard = await login('smoke-viewer');
  assert.doesNotMatch(viewerInvoiceDashboard, /invoice-summary-heading|data-invoice-(?:count|total)|\/invoices\?status=/);
  const viewerInvoices = await (await request(invoicePath)).text();
  assert.ok(!viewerInvoices.includes(invoiceBase.number) && !viewerInvoices.includes('QA-INV/002'));
  assert.ok(!(await post(invoicePath, adminCreateInvoice, {
    ...invoiceBase, number: 'QA-INV/VIEWER',
  })).text.includes('Invoice tersimpan'));
  assertDashboardInvoices(
    await login('smoke-admin'),
    { billed: 'Rp 200.000,25', paid: 'Rp 0', balance: 'Rp 200.000,25', overdue: 'Rp 200.000,25' },
    { DRAFT: 0, SENT: 0, PARTIAL: 0, PAID: 0, OVERDUE: 1, VOID: 1 },
  );
  console.log('PASS completed-project and completed-PO eligibility, full project names, historical billing after reopening, exact payments, retry, overpayment race, void, and Viewer denial');
  console.log('PASS dashboard invoice totals and counts synchronize with payments and voids, with status links and Viewer isolation');
  const sphValues = { number: 'QA-SPH/001', clientName: 'Synthetic customer', title: 'Synthetic quotation', value: '2000000', issuedDate: '2026-09-01', sentDate: '2026-09-02', validUntil: '2026-12-31', followUpDate: '2026-10-10', pic: 'QA admin', status: 'SENT', notes: 'Isolated test only' };
  const createSph = await form('/quotations', 'number', f => !f.get('id'));
  assert.ok((await post('/quotations', createSph, sphValues)).text.includes('SPH tersimpan'));
  assert.ok(!(await post('/quotations', createSph, sphValues)).text.includes('SPH tersimpan'));
  const editSph = await form('/quotations', 'number', f => !!f.get('id'));
  const sphId = String(editSph.get('id'));
  const sphLink = await form('/quotations', 'operation', f => f.get('quotationId') === sphId && f.get('operation') === 'link');
  assert.ok((await post('/quotations', sphLink, {projectId:'smoke-p1'})).text.includes('Hubungan SPH'));
  assert.ok((await post('/quotations', editSph, sphValues)).text.includes('SPH sudah berubah'));
  assert.ok((await (await request('/quotations')).text()).includes('Sebagian menjadi PO'));
  // A second existing customer PO links to the same quotation without duplicating revenue.
  const secondPo = await form('/customer-po', 'customerPoNumber', f => f.get('projectId') === 'smoke-p2');
  assert.ok((await post('/customer-po', secondPo, {...poValues, projectId:'smoke-p2', customerPoNumber:'QA-PO/002',poValue:'500000'})).text.includes('PO Customer tersimpan'));
  const secondLink = await form('/quotations','operation',f => f.get('quotationId') === sphId && f.get('operation') === 'link');
  assert.ok((await post('/quotations', secondLink, {projectId:'smoke-p2'})).text.includes('Hubungan SPH'));
  const duplicateLink = await form('/quotations','operation',f => f.get('quotationId') === sphId && f.get('operation') === 'link');
  assert.ok((await post('/quotations',duplicateLink,{projectId:'smoke-p1'})).text.includes('sudah terhubung'));
  const completeSph = await form('/quotations','number',f => f.get('id') === sphId);
  assert.ok((await post('/quotations',completeSph,{...sphValues,status:'WON'})).text.includes('SPH tersimpan'));
  const sphHtml = await (await request('/quotations')).text();
  assert.ok(sphHtml.includes('QA-PO/001') && sphHtml.includes('QA-PO/002'));
  const detach = await form('/quotations','operation',f => f.get('operation') === 'unlink' && f.get('projectId') === 'smoke-p2');
  assert.ok((await post('/quotations',detach,{})).text.includes('Hubungan SPH'));
  const sphReplay = await form('/quotations','number',f => f.get('id') === sphId);
  console.log('PASS SPH create, duplicate number, stale write, multi-PO linkage, duplicate link guard, completion and unlink');
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
  const defaultViewer=await login('smoke-viewer');
  assert.ok(defaultViewer.includes('QA-001')&&defaultViewer.includes('QA-002'));
  assert.ok(!defaultViewer.includes('forecastCost')&&!defaultViewer.includes('budgetValue'));
  assert.ok(!defaultViewer.includes('QA Confidential Contract.pdf'));
  assert.equal((await request('/api/documents/smoke-private-doc/download')).status,404);
  assert.ok(!(await(await request('/finance')).text()).includes('QA-001'));
  assert.ok(!(await(await request('/team-targets')).text()).includes('QA daily assembly'));
  assert.ok(!(await(await request('/boq')).text()).includes('QA-001'));
  await login('smoke-admin');
  const permit=await form('/settings?viewerId=smoke-viewer','scopes',f=>f.get('projectId')==='smoke-p1');
  for(const scope of ['PROJECT','PO','FINANCE','BOQ','DOCUMENTS','TIME_PLAN','TEAM_TARGETS','OPERATIONS']) permit.append('scopes',scope);
  assert.ok((await post('/settings?viewerId=smoke-viewer',permit,{})).text.includes('Izin Viewer tersimpan'));
  assert.ok((await post('/settings?viewerId=smoke-viewer',permit,{})).text.includes('Izin sudah berubah'));
  const deny=await form('/settings?viewerId=smoke-viewer','scopes',f=>f.get('projectId')==='smoke-p2');
  assert.ok((await post('/settings?viewerId=smoke-viewer',deny,{})).text.includes('Izin Viewer tersimpan'));
  const viewerHome = await login('smoke-viewer');
  assert.ok(viewerHome.includes('Dashboard Viewer'));
  assert.ok(viewerHome.includes('QA Confidential Contract.pdf'));
  assert.ok((await post('/settings?viewerId=smoke-viewer',permit,{})).text.includes('Akses pengaturan izin ditolak'));
  assert.ok(!viewerHome.includes('Admin / Project Manager · nilai penawaran'));
  assert.ok(!viewerHome.includes('QA internal private task'));
  const viewerTargets=await(await request(teamPath)).text();
  assert.ok(viewerTargets.includes('QA daily assembly')&&!viewerTargets.includes('QA internal private task'));
  assert.ok((await post(teamPath,dailyReplay,dailyValues)).text.includes('Akses ubah Target Tim ditolak'));
  const viewerSites = await (await request('/dashboard/sites?category=active')).text();
  assert.ok(viewerSites.includes('QA-001') && !viewerSites.includes('QA-002'));
  assert.ok((await (await request('/quotations')).text()).includes('hanya dapat diakses'));
  assert.ok((await post('/quotations',sphReplay,sphValues)).text.includes('Hanya Admin'));
  assert.ok(
    (await post('/boq', manualReplay, manualValues)).text.includes(
      'Akses input manual BoQ ditolak',
    ),
  );
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
  const viewerFinance = await (await request('/finance')).text();
  assert.ok(
    viewerFinance.includes('QA-001') && !viewerFinance.includes('QA-002'),
  );
  assert.ok(viewerPo.includes('QA-001') && !viewerPo.includes('QA-002'));
  assert.ok(
    (await post('/customer-po', updatedPo, poValues)).text.includes(
      'Hanya Admin',
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
    403,
  );
  const viewerWrite = await post('/production', production, values);
  assert.ok(viewerWrite.text.includes('Akses simpan tidak tersedia'));
  assert.ok((await post('/finance',adminBudget,{projectId:'smoke-p1',poValue:'1300000.50',budgetValue:'800000',forecastCost:'750000'})).text.includes('hanya untuk Admin'));
  assert.ok((await post('/time-plan',planActivation,{active:'false'})).text.includes('Hanya Admin'));
  assert.equal((await request('/api/documents/upload',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'smoke-p1',category:'PURCHASE_ORDER',fileName:'po.pdf',mimeType:'application/pdf',sizeBytes:100})})).status,403);
  console.log(
    'PASS viewer project isolation, export denial and mutation denial',
  );
  await login('smoke-pm');
  const pmForeignPermission=await form('/settings?viewerId=smoke-viewer','scopes',f=>f.get('projectId')==='smoke-p2');
  pmForeignPermission.append('scopes','PROJECT');pmForeignPermission.append('scopes','PO');
  assert.ok((await post('/settings?viewerId=smoke-viewer',pmForeignPermission,{})).text.includes('Izin Viewer tersimpan'));
  assert.ok((await login('smoke-viewer')).includes('QA-002'));
  await login('smoke-pm');
  const pmForeignRevoke=await form('/settings?viewerId=smoke-viewer','scopes',f=>f.get('projectId')==='smoke-p2');
  assert.ok((await post('/settings?viewerId=smoke-viewer',pmForeignRevoke,{})).text.includes('Izin Viewer tersimpan'));
  const pmPermission=await form('/settings?viewerId=smoke-viewer','scopes',f=>f.get('projectId')==='smoke-p1');
  pmPermission.append('scopes','PROJECT');pmPermission.append('scopes','PO');
  assert.ok((await post('/settings?viewerId=smoke-viewer',pmPermission,{})).text.includes('Izin Viewer tersimpan'));
  await login('smoke-viewer');
  assert.ok(!(await(await request('/finance')).text()).includes('QA-001'));
  assert.equal((await request('/api/documents/smoke-private-doc/download')).status,404);
  assert.ok(!(await(await request('/team-targets')).text()).includes('QA daily assembly'));
  await login('smoke-pm');
  const permissionPath='/settings?viewerId=smoke-viewer';
  const bulkGrant=await form(permissionPath,'scopes',f=>f.get('projectId')==='smoke-p1');
  for(const scope of ['PROJECT','PO','MATERIALS','BOQ'])bulkGrant.append('scopes',scope);
  assert.ok((await post(permissionPath,bulkGrant,{})).text.includes('Izin Viewer tersimpan'));
  assert.ok((await post(permissionPath,bulkGrant,{})).text.includes('sudah berubah'));
  await login('smoke-viewer');
  const bulkMaterials=await(await request('/materials')).text();
  assert.ok(bulkMaterials.includes('QA bulk material one')&&!bulkMaterials.includes('QA bulk material two'));
  assert.ok((await(await request('/boq')).text()).includes('QA-001'));
  assert.ok(!(await(await request('/finance')).text()).includes('QA-001'));
  assert.ok(!(await(await request('/production')).text()).includes('QA-001'));
  assert.ok((await post(permissionPath,bulkGrant,{})).text.includes('Akses pengaturan izin ditolak'));
  await login('smoke-pm');
  const globalGrant=await form(permissionPath,'portfolioVersion');
  assert.ok((await post(permissionPath,globalGrant,{userId:'smoke-pm'})).text.includes('Pilih akun Viewer aktif'));
  globalGrant.set('userId','smoke-viewer');
  assert.ok((await post(permissionPath,globalGrant,{})).text.includes('BoQ diaktifkan, termasuk proyek baru'));
  assert.ok((await post(permissionPath,globalGrant,{})).text.includes('Izin sudah berubah'));
  // Explicitly targets the isolated fixture, never DATABASE_URL from .env.
  const fixtureClient=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'});
  await fixtureClient.connect();
  try {
    await fixtureClient.query(`INSERT INTO "Project" ("id","code","name","updatedAt") VALUES ('smoke-future','QA-FUTURE','Project created after global grant',now());
      INSERT INTO "Material" ("id","projectId","code","description","unit","requiredQty","updatedAt") VALUES ('bulk-future','smoke-future','BULK-FUTURE','QA future material','UNIT',1,now());`);
  } finally {await fixtureClient.end();}
  const globalRevoke=await form(permissionPath,'portfolioVersion');
  const globalHome=await login('smoke-viewer');
  assert.ok(globalHome.includes('QA-001')&&globalHome.includes('QA-002'));
  assert.ok(globalHome.includes('QA-FUTURE'));
  const globalMaterials=await(await request('/materials')).text();
  assert.ok(globalMaterials.includes('QA bulk material one')&&globalMaterials.includes('QA bulk material two'));
  assert.ok(globalMaterials.includes('QA future material'));
  assert.ok((await(await request('/customer-po')).text()).includes('QA-002'));
  assert.ok((await(await request('/boq')).text()).includes('QA-002'));
  assert.ok((await(await request('/boq')).text()).includes('QA-FUTURE'));
  assert.ok(!(await(await request('/finance')).text()).includes('QA-002'));
  assert.ok(!(await(await request('/production')).text()).includes('QA-002'));
  assert.equal((await request('/api/documents/smoke-private-doc/download')).status,404);
  assert.ok((await post(permissionPath,globalRevoke,{})).text.includes('Hanya Admin'));
  assert.ok((await post('/boq',manualReplay,manualValues)).text.includes('Akses input manual BoQ ditolak'));
  await login('smoke-pm');
  assert.ok((await post(permissionPath,globalRevoke,{})).text.includes('Akses global dinonaktifkan'));
  const afterRevoke=await login('smoke-viewer');
  assert.ok(!afterRevoke.includes('QA-002'));
  assert.ok(!(await(await request('/materials')).text()).includes('QA bulk material two'));
  assert.ok(!(await(await request('/boq')).text()).includes('QA-FUTURE'));
  console.log('PASS PM manages Viewer permissions across projects, stale grants, global toggle, sensitive scope isolation and revocation');
  await login('smoke-pm');
  const pmDaily=await form(teamPath,'targetQty',f=>!f.get('id'));
  assert.ok((await post(teamPath,pmDaily,{...dailyValues,projectId:'smoke-p2',title:'QA PM foreign-project daily task'})).text.includes('Target harian tersimpan'));
  assert.ok((await post(teamPath,await form(teamPath,'targetQty',f=>!f.get('id')),{...dailyValues,projectId:'',title:'QA PM general daily task'})).text.includes('Target harian tersimpan'));
  assert.ok((await post(teamPath,await form(teamPath,'targetQty',f=>!f.get('id')),{...dailyValues,title:'QA PM own daily task'})).text.includes('Target harian tersimpan'));
  const pmManual = await form('/boq', 'manualRows');
  assert.ok((await post('/boq',pmManual,{...manualValues,projectId:'smoke-p2',expectedVersion:'0'})).text.includes('BoQ manual versi 1 tersimpan'));
  assert.ok(
    (
      await post('/boq', await form('/boq','manualRows'), {
        ...manualValues,
        expectedVersion:'2',
        manualRows: JSON.stringify(
          manualItems.map((r) => ({ ...r, unitPrice: '300' })),
        ),
      })
    ).text.includes('BoQ manual versi 3 tersimpan'),
  );
  const pmPlan = await form(
    '/time-plan',
    'weight',
    (f) => f.get('id') === secondTaskId,
  );
  assert.ok(
    (
      await post('/time-plan', pmPlan, { ...secondUpdate, progressPct: '75' })
    ).text.includes('Pekerjaan tersimpan'),
  );
  assert.equal(await reportProgress(), 80);
  assert.ok((await post('/time-plan',await form('/time-plan','active'),{active:'false'})).text.includes('Time Plan kembali Draft'));
  assert.ok((await post('/time-plan',await form('/time-plan','active'),{active:'true'})).text.includes('Time Plan aktif'));
  const foreignTask=await form('/time-plan?projectId=smoke-p2','weight',f=>!f.get('id'));
  assert.ok((await post('/time-plan?projectId=smoke-p2',foreignTask,{...taskValues,projectId:'smoke-p2',weight:'100',title:'PM plan on unassigned project',predecessorId:''})).text.includes('Pekerjaan tersimpan'));
  const pmPo=await form('/customer-po','customerPoNumber',f=>f.get('projectId')==='smoke-p2');
  assert.ok((await post('/customer-po',pmPo,{...poValues,projectId:'smoke-p2',customerPoNumber:'QA-PO/002',poValue:'500000',customerPoNotes:'Updated by PM with global access'})).text.includes('PO Customer tersimpan'));
  assert.equal((await request('/api/reports?type=portfolio&format=xlsx&projectId=smoke-p2')).status,200);
  const pmQuotation=await form('/quotations','number',f=>!f.get('id'));
  assert.ok((await post('/quotations',pmQuotation,{...sphValues,number:'QA-SPH/PM',title:'Project manager quotation'})).text.includes('SPH tersimpan'));
  assert.equal(
    (
      await request('/api/documents/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 'missing-project',
          category: 'PURCHASE_ORDER',
          fileName: 'po.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        }),
      })
    ).status,
    404,
  );
  assert.equal((await request('/api/documents/missing-document/complete',{method:'POST'})).status,404);
  const pmBudget = await post('/finance',await form('/finance','budgetValue',f=>f.get('projectId')==='smoke-p2'), {
    projectId: 'smoke-p2',
    poValue: '500000',
    budgetValue: '410000',
    forecastCost: '310000',
  });
  assert.ok(pmBudget.text.includes('Baseline finance diperbarui'));
  console.log('PASS PM manages unassigned project BoQ, PO, Finance, SPH, Time Plan, general activities and reports');

  const createAccount=await form('/settings','username');
  const newAccount={username:'qa-pm-created',displayName:'Created by PM',role:'VIEWER',password:'Local-PM-Created-2026!'};
  const createProject=await projectActionForm('createProjectAction');
  const newProject={code:'QA-PM-CREATED',name:'Project created by PM',clientName:'QA customer',status:'ACTIVE',health:'ON_TRACK',phase:'PLANNING',progressPct:'0',poValue:'0',budgetValue:'100',actualCost:'0',forecastCost:'90',address:'QA address',latitude:'',longitude:'',plannedStart:'',plannedFinish:'',actualFinish:'',projectManagerId:'smoke-admin'};
  const updateProject=await projectActionForm('updateProjectAction');
  const archiveProject=await projectActionForm('archiveProjectAction');
  await login('smoke-viewer');
  assert.ok((await post('/settings',createAccount,newAccount)).text.includes('Hanya Admin'));
  assert.ok((await post('/projects',createProject,newProject)).text.includes('Hanya Admin'));
  assert.ok((await post('/projects',updateProject,{})).text.includes('Viewer tidak dapat mengubah'));
  assert.ok((await post('/projects',archiveProject,{})).text.includes('Hanya Admin'));
  assert.equal((await request('/api/documents/missing-document/complete',{method:'POST'})).status,403);
  await login('smoke-pm');
  assert.ok((await post('/settings',createAccount,newAccount)).text.includes('Akun dibuat'));
  assert.ok((await post('/projects',createProject,newProject)).text.includes('QA-PM-CREATED berhasil dibuat'));
  const identityDb=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'});
  await identityDb.connect();
  try {
    const createdUserId=String((await identityDb.query(`SELECT id FROM "User" WHERE "normalizedUsername"='qa-pm-created'`)).rows[0].id);
    const activeUser=await form('/settings','active',f=>f.get('id')===createdUserId);
    await login('smoke-viewer');
    assert.ok((await post('/settings',activeUser,{active:'false'})).text.includes('Akses ditolak'));
    await login('smoke-pm');
    assert.ok((await post('/settings',activeUser,{active:'false'})).text.includes('Status akun diperbarui'));
    assert.ok((await post('/settings',await form('/settings','active',f=>f.get('id')===createdUserId),{active:'true'})).text.includes('Status akun diperbarui'));
    const adminDeactivate=await form('/settings','active',f=>f.get('id')==='smoke-admin');
    assert.ok((await post('/settings',adminDeactivate,{active:'false'})).text.includes('Status akun belum dapat diperbarui'));
    assert.ok((await post('/settings',adminDeactivate,{id:'smoke-pm',active:'false'})).text.includes('Akun sendiri tidak dapat dinonaktifkan'));
    const record=(await identityDb.query(`SELECT id,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt" FROM "Project" WHERE code='QA-PM-CREATED'`)).rows[0];
    const projectIdentity={id:String(record.id),updatedAt:new Date(record.updatedAt).toISOString()};
    const pmProjectUpdate=await post('/projects',updateProject,{...newProject,...projectIdentity,name:'Project edited by PM',budgetValue:'150'});
    assert.ok(pmProjectUpdate.text.includes('berhasil diperbarui'),pmProjectUpdate.text.slice(-1800));
    const updated=(await identityDb.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt" FROM "Project" WHERE id=$1`,[record.id])).rows[0];
    assert.ok((await post('/projects',archiveProject,{id:String(record.id),updatedAt:new Date(updated.updatedAt).toISOString(),confirm:'yes'})).text.includes('Project berhasil diarsipkan'));
    const draft=(await identityDb.query(`SELECT id FROM "Boq" WHERE "projectId"='smoke-p2' AND status='DRAFT' ORDER BY version DESC LIMIT 1`)).rows[0];
    const approval={boqId:String(draft.id),expectedApprovedBoqId:null};
    await login('smoke-viewer');
    assert.ok((await approveViaHttp(approval)).includes('Hanya Admin'));
    await login('smoke-pm');
    assert.ok((await approveViaHttp(approval)).includes('menjadi baseline approved'));
  } finally {await identityDb.end();}
  console.log('PASS PM creates/edits/archives projects, assigns managers, manages users, preserves last Admin and Viewer mutation boundaries');
  // Large portfolio fixture is isolated from production credentials and data.
  const batchDb=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'});
  await batchDb.connect();
  try {
    const batchIds=Array.from({length:100},(_,i)=>`smoke-batch-${i}`);
    await batchDb.query(`INSERT INTO "Project" ("id","code","name","updatedAt") SELECT id, upper(id), 'Batch test project',now() FROM unnest($1::text[]) AS selected(id)`,[batchIds]);
    const batchForm=await form('/settings','projectIds');
    for(const id of batchIds) batchForm.append('projectIds',id);
    const started=Date.now();
    assert.ok((await post('/settings',batchForm,{userId:'smoke-member-target',operation:'add'})).text.includes('100 proyek berhasil ditambahkan'));
    assert.ok((await post('/settings',batchForm,{})).text.includes('100 proyek berhasil ditambahkan'));
    const count=async(userId:string)=>Number((await batchDb.query(`SELECT count(*) AS count FROM "ProjectMember" WHERE "userId"=$1 AND "projectId"=ANY($2::text[])`,[userId,batchIds])).rows[0].count);
    assert.equal(await count('smoke-member-target'),100);
    assert.ok((await post('/settings',batchForm,{userId:'smoke-admin'})).text.includes('Akun ADMIN sudah memiliki akses semua proyek dan PO'));
    assert.equal(await count('smoke-admin'),0);
    assert.ok((await post('/settings',batchForm,{userId:'smoke-pm'})).text.includes('Akun PROJECT_MANAGER sudah memiliki akses semua proyek dan PO'));
    assert.equal(await count('smoke-pm'),0);
    assert.ok((await post('/settings',batchForm,{userId:'smoke-member-target',operation:'remove',confirmBulkRemove:'yes'})).text.includes('100 proyek berhasil dicabut'));
    assert.equal(await count('smoke-member-target'),0);
    const audit=await batchDb.query(`SELECT count(*) AS count FROM "AuditLog" WHERE "projectId"=ANY($1::text[]) AND "entityType"='ProjectMember'`,[batchIds]);
    assert.equal(Number(audit.rows[0].count),300);
    console.log(`PASS PM 100-project batch grant/retry/revoke, complete audit log, and full-role no-op (${Date.now()-started}ms local)`);
  } finally {await batchDb.end();}

  // Warehouse fixtures use the local test database only. No real stock is seeded.
  await login('smoke-pm');
  const warehouseDb=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'});
  await warehouseDb.connect();
  try {
    for(const [suffix,unit,required,status] of [['a','M','5','APPROVED'],['b','M','100','APPROVED'],['c','PCS','100','APPROVED'],['draft','M','100','DRAFT']]) {
      await warehouseDb.query(`INSERT INTO "Project" (id,code,name,"updatedAt") VALUES ($1,$2,$3,now())`,[`wh-project-${suffix}`,`WH-${suffix.toUpperCase()}`,`Warehouse acceptance project ${suffix}`]);
      await warehouseDb.query(`INSERT INTO "Boq" (id,"projectId",version,"updatedAt") VALUES ($1,$2,1,now())`,[`wh-boq-${suffix}`,`wh-project-${suffix}`]);
      await warehouseDb.query(`INSERT INTO "BoqItem" (id,"boqId","itemNo","itemCode","itemType",description,unit,quantity,"unitPrice","lineTotal") VALUES ($1,$2,'1','WH-CABLE','MATERIAL','Warehouse cable fixture',$3,$4,10,$4::numeric*10)`,[`wh-boq-item-${suffix}`,`wh-boq-${suffix}`,unit,required]);
      if(status==='APPROVED') await warehouseDb.query(`UPDATE "Boq" SET status='APPROVED',"approvedAt"=now() WHERE id=$1`,[`wh-boq-${suffix}`]);
      await warehouseDb.query(`INSERT INTO "Material" (id,"projectId","boqItemId",code,"normalizedCode",description,unit,"requiredQty","updatedAt") VALUES ($1,$2,$3,'WH-CABLE','WH-CABLE','Warehouse cable fixture',$4,$5,now())`,[`wh-material-${suffix}`,`wh-project-${suffix}`,`wh-boq-item-${suffix}`,unit,required]);
    }
    const whAction=(name:string)=>actionStateForm(name,'app/actions/warehouse.ts');
    const createStock=await whAction('createWarehouseItem');
    await post('/warehouse',createStock,{code:'WH-CABLE',description:'QA warehouse cable',unit:'PCS',location:'QA Rack A1',minQty:'2'});
    const stockId=String((await warehouseDb.query(`SELECT id FROM "WarehouseItem" WHERE "normalizedCode"='WH-CABLE'`)).rows[0]?.id);
    assert.notEqual(stockId,'undefined','PM should create a warehouse SKU');
    const balance=async(id=stockId)=>String((await warehouseDb.query(`SELECT quantity::text AS quantity FROM "WarehouseItem" WHERE id=$1`,[id])).rows[0].quantity);
    const projectBalance=async(suffix='a')=>(await warehouseDb.query(`SELECT "receivedQty"::text AS received,"warehouseIssuedQty"::text AS issued,"installedQty"::text AS installed FROM "Material" WHERE id=$1`,[`wh-material-${suffix}`])).rows[0];
    const movementCount=async(requestId:string)=>Number((await warehouseDb.query(`SELECT count(*) AS count FROM "WarehouseMovement" WHERE "requestId"=$1`,[requestId])).rows[0].count);
    const stockIdentity=async(id=stockId)=>(await warehouseDb.query(`SELECT id,code,"normalizedCode",description,unit,location,"minQty"::text AS "minQty",quantity::text AS quantity,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt" FROM "WarehouseItem" WHERE id=$1`,[id])).rows[0];
    const stockInvariant=(row:Record<string,string>)=>Object.fromEntries(['id','location','quantity'].map(key=>[key,row[key]]));
    const editValues=(row:Record<string,string>,code=row.code,description=row.description)=>({id:row.id,updatedAt:row.updatedAt,code,description,unit:row.unit,minQty:row.minQty});
    const lowStockMetric=async()=>{
      const html=await(await request('/warehouse')).text();
      const value=html.match(/Stok ≤ minimum<\/p>\s*<p\b[^>]*>(\d+)<\/p>/)?.[1];
      assert.notEqual(value,undefined,'Warehouse low-stock metric should render');return Number(value);
    };
    const editAuditCount=async()=>Number((await warehouseDb.query(`SELECT count(*) AS count FROM "AuditLog" WHERE "entityType"='WarehouseItem' AND "entityId"=$1 AND action='WAREHOUSE_ITEM_UPDATED'`,[stockId])).rows[0].count);
    const unstockedIdentity=await stockIdentity();
    await post('/warehouse',await whAction('updateWarehouseItem'),{...editValues(unstockedIdentity),unit:'  m  '});
    const initialStockIdentity=await stockIdentity();
    assert.equal(initialStockIdentity.unit,'M','A unit can be corrected before its first stock transaction');
    assert.deepEqual(stockInvariant(initialStockIdentity),stockInvariant(unstockedIdentity));
    assert.equal(await balance(),'0.0000');
    const receiptForm=await whAction('receiveWarehouseStock');
    const receipt={requestId:randomUUID(),warehouseItemId:stockId,expectedUnit:'M',quantity:'10.5',referenceNo:'WH-IN-001',recipient:'QA warehouse keeper',notes:'Synthetic receipt'};
    await post('/warehouse',receiptForm,{...receipt,expectedUnit:'PCS'});
    assert.equal(await balance(),'0.0000','A first receipt opened before a unit correction must not credit stock');
    assert.equal(await movementCount(receipt.requestId),0);
    await post('/warehouse',receiptForm,receipt);
    assert.equal(await balance(),'10.5000');
    await post('/warehouse',receiptForm,receipt);
    assert.equal(await balance(),'10.5000');
    assert.equal(await movementCount(receipt.requestId),1);
    await post('/warehouse',receiptForm,{...receipt,quantity:'10.5000'});
    assert.equal(await balance(),'10.5000','Equivalent exact quantities should remain an idempotent retry');
    await post('/warehouse',receiptForm,{...receipt,quantity:'11'});
    assert.equal(await balance(),'10.5000','Same request ID with altered payload must not apply');
    const zeroBalanceIssue={requestId:randomUUID(),warehouseItemId:stockId,materialId:'wh-material-b',quantity:'10.5',referenceNo:'WH-UNIT-HISTORY-OUT',recipient:'QA unit correction test',notes:'Isolated unit history fixture'};
    await post('/warehouse',await whAction('issueWarehouseStock'),zeroBalanceIssue);
    assert.equal(await balance(),'0.0000');
    const zeroBalanceIdentity=await stockIdentity();
    await post('/warehouse',await whAction('updateWarehouseItem'),{...editValues(zeroBalanceIdentity),unit:'PCS'});
    assert.deepEqual(await stockIdentity(),zeroBalanceIdentity,'Net-zero stock with movement history must not allow a unit change');
    const zeroBalanceIssueId=String((await warehouseDb.query(`SELECT id FROM "WarehouseMovement" WHERE "requestId"=$1`,[zeroBalanceIssue.requestId])).rows[0].id);
    await post('/warehouse',await whAction('returnWarehouseStock'),{requestId:randomUUID(),issueId:zeroBalanceIssueId,quantity:'10.5',referenceNo:'WH-UNIT-HISTORY-RETURN',recipient:'QA warehouse keeper',notes:'Restore isolated unit history fixture'});
    assert.equal(await balance(),'10.5000');
    assert.deepEqual(await projectBalance('b'),{received:'0.0000',issued:'0.0000',installed:'0.0000'});
    const beforeIdentityEdit=await stockIdentity();
    const lowStockBeforeEdit=await lowStockMetric();
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(initialStockIdentity,'WH-STALE-RECEIPT','Stale receipt identity'));
    assert.deepEqual(await stockIdentity(),beforeIdentityEdit,'A stock movement must invalidate an older edit version');
    await post('/warehouse',await whAction('updateWarehouseItem'),{...editValues(beforeIdentityEdit,'  wh-cable-edited  ','  QA renamed warehouse cable  '),quantity:'99999',location:'Injected rack',minQty:'12'});
    const editedStock=await stockIdentity();
    assert.equal(editedStock.code,'WH-CABLE-EDITED');
    assert.equal(editedStock.normalizedCode,'WH-CABLE-EDITED');
    assert.equal(editedStock.description,'QA renamed warehouse cable');
    assert.equal(editedStock.unit,'M');
    assert.equal(editedStock.minQty,'12.0000','Minimum stock may be edited even after warehouse movements');
    assert.equal(await lowStockMetric(),lowStockBeforeEdit+1,'A changed minimum must immediately update the warehouse low-stock metric');
    assert.deepEqual(stockInvariant(editedStock),stockInvariant(beforeIdentityEdit),'Editing master data must preserve the SKU ID, balance and rack');
    const editAudit=(await warehouseDb.query(`SELECT "userId",metadata FROM "AuditLog" WHERE "entityType"='WarehouseItem' AND "entityId"=$1 AND action='WAREHOUSE_ITEM_UPDATED' ORDER BY "createdAt" DESC LIMIT 1`,[stockId])).rows[0];
    assert.equal(editAudit.userId,'smoke-pm');
    assert.deepEqual(editAudit.metadata,{before:{code:'WH-CABLE',description:'QA warehouse cable',unit:'M',minQty:'2.0000'},after:{code:'WH-CABLE-EDITED',description:'QA renamed warehouse cable',unit:'M',minQty:'12.0000'}});
    assert.equal((await warehouseDb.query(`SELECT "warehouseItemId" FROM "WarehouseMovement" WHERE "requestId"=$1`,[receipt.requestId])).rows[0].warehouseItemId,stockId);
    assert.equal((await warehouseDb.query(`SELECT code FROM "Material" WHERE id='wh-material-a'`)).rows[0].code,'WH-CABLE');
    assert.equal((await warehouseDb.query(`SELECT "itemCode" FROM "BoqItem" WHERE id='wh-boq-item-a'`)).rows[0].itemCode,'WH-CABLE','Approved BoQ codes must not be rewritten by a warehouse edit');
    const beforeRejectedEdit=await editAuditCount();
    for(const invalid of [{code:' '},{description:' '},{updatedAt:'invalid'},{id:'missing-stock-item'},{unit:' '},{unit:'PCS'},{minQty:'-1'},{minQty:'1e3'},{minQty:'1.12345'}]) {
      await post('/warehouse',await whAction('updateWarehouseItem'),{...editValues(editedStock),...invalid});
      assert.deepEqual(await stockIdentity(),editedStock,'Invalid or missing warehouse identities must not mutate stock');
    }
    for(const field of ['unit','minQty']) {
      const missing:Record<string,string>=editValues(editedStock);delete missing[field];
      await post('/warehouse',await whAction('updateWarehouseItem'),missing);
      assert.deepEqual(await stockIdentity(),editedStock,'Missing edit values must not silently reset unit or minimum');
    }
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(beforeIdentityEdit,'WH-STALE-EDIT','Stale edit identity'));
    assert.deepEqual(await stockIdentity(),editedStock,'An older editor cannot overwrite a saved rename');
    await post('/warehouse',await whAction('createWarehouseItem'),{code:'WH-EDIT-TAKEN',description:'Reserved duplicate-code fixture',unit:'M',location:'QA Rack C1',minQty:'0'});
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(editedStock,'  ｗｈ－ｅｄｉｔ－ｔａｋｅｎ  ','Duplicate identity'));
    assert.deepEqual(await stockIdentity(),editedStock,'Normalized duplicate codes must be rejected atomically');
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(editedStock));
    assert.equal(await editAuditCount(),beforeRejectedEdit,'Rejected and no-op edits must not add change audit events');
    const concurrentEditForms=[await whAction('updateWarehouseItem'),await whAction('updateWarehouseItem')];
    await Promise.all(concurrentEditForms.map((body,index)=>post('/warehouse',body,editValues(editedStock,`WH-EDIT-RACE-${index}`,`Concurrent warehouse edit ${index}`))));
    const raceEditedStock=await stockIdentity();
    assert.ok(['WH-EDIT-RACE-0','WH-EDIT-RACE-1'].includes(raceEditedStock.code));
    assert.deepEqual(stockInvariant(raceEditedStock),stockInvariant(beforeIdentityEdit));
    assert.equal(await editAuditCount(),beforeRejectedEdit+1,'Only one overlapping edit may use the same version');
    const lowStockBeforeRestore=await lowStockMetric();
    await post('/warehouse',await whAction('updateWarehouseItem'),{...editValues(raceEditedStock,'WH-CABLE','QA warehouse cable'),minQty:'2'});
    assert.equal((await stockIdentity()).code,'WH-CABLE');
    assert.equal((await stockIdentity()).minQty,'2.0000');
    assert.equal(await lowStockMetric(),lowStockBeforeRestore-1);
    const viewerEditForm=await whAction('updateWarehouseItem');
    const beforeViewerEdit=await stockIdentity();
    const issueForm=await whAction('issueWarehouseStock');
    const issue={requestId:randomUUID(),warehouseItemId:stockId,materialId:'wh-material-a',quantity:'3.25',referenceNo:'WH-OUT-001',recipient:'QA site team',notes:'Synthetic issue'};
    await login('smoke-viewer');
    const viewerWarehouse=await(await request('/warehouse')).text();
    assert.ok(!viewerWarehouse.includes('QA warehouse cable')&&!viewerWarehouse.includes('WH-IN-001'));
    await post('/warehouse',receiptForm,{...receipt,requestId:randomUUID(),quantity:'1'});
    await post('/warehouse',issueForm,issue);
    await post('/warehouse',viewerEditForm,editValues(beforeViewerEdit,'WH-VIEWER-EDIT','Viewer warehouse rename'));
    assert.deepEqual(await stockIdentity(),beforeViewerEdit,'Viewer direct action requests cannot rename warehouse stock');
    assert.equal(await balance(),'10.5000');
    assert.deepEqual(await projectBalance(),{received:'0.0000',issued:'0.0000',installed:'0.0000'});
    await login('smoke-pm');
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),quantity:'12'});
    assert.equal(await balance(),'10.5000','Insufficient stock must be rejected');
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),materialId:'wh-material-c',quantity:'1'});
    assert.equal(await balance(),'10.5000','Unit mismatch must be rejected');
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),materialId:'wh-material-draft',quantity:'1'});
    assert.equal(await balance(),'10.5000','Draft BoQ cannot consume warehouse stock');
    await post('/warehouse',await whAction('createWarehouseItem'),{code:'WH-OTHER',description:'QA different warehouse material',unit:'M',location:'QA Rack B1',minQty:'0'});
    const otherStock=String((await warehouseDb.query(`SELECT id FROM "WarehouseItem" WHERE "normalizedCode"='WH-OTHER'`)).rows[0].id);
    await post('/warehouse',await whAction('receiveWarehouseStock'),{...receipt,requestId:randomUUID(),warehouseItemId:otherStock,quantity:'5',referenceNo:'WH-IN-OTHER'});
    const simultaneousReceipt={...receipt,requestId:randomUUID(),warehouseItemId:otherStock,quantity:'1',referenceNo:'WH-IN-RETRY'};
    const receiptRaceForms=[await whAction('receiveWarehouseStock'),await whAction('receiveWarehouseStock')];
    await Promise.all(receiptRaceForms.map(f=>post('/warehouse',f,simultaneousReceipt)));
    assert.equal(await movementCount(simultaneousReceipt.requestId),1);
    assert.equal(await balance(otherStock),'6.0000','Concurrent retries must credit stock only once');
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),warehouseItemId:otherStock,quantity:'1'});
    assert.equal(await balance(otherStock),'6.0000','Code mismatch must be rejected');
    await post('/warehouse',issueForm,issue);
    assert.equal(await balance(),'7.2500');
    assert.deepEqual(await projectBalance(),{received:'3.2500',issued:'3.2500',installed:'0.0000'});
    await post('/warehouse',issueForm,issue);
    assert.equal(await balance(),'7.2500');
    assert.equal(await movementCount(issue.requestId),1);
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),quantity:'2'});
    assert.equal(await balance(),'7.2500','Issue cannot exceed remaining approved BoQ requirement');
    const materialVersion=String((await warehouseDb.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS version FROM "Material" WHERE id='wh-material-a'`)).rows[0].version);
    await post('/materials',await actionStateForm('updateMaterialAction','app/actions/materials.ts'),{id:'wh-material-a',updatedAt:materialVersion,orderedQty:'0',receivedQty:'1',installedQty:'0',supplier:'',purchaseOrderNo:'',needByDate:'',estimatedArrival:'',status:'PARTIAL'});
    assert.equal((await projectBalance()).received,'3.2500','Manual update cannot hide warehouse-issued receipts');
    const issueId=String((await warehouseDb.query(`SELECT id FROM "WarehouseMovement" WHERE "requestId"=$1`,[issue.requestId])).rows[0].id);
    const returnForm=await whAction('returnWarehouseStock');
    const returnValues={requestId:randomUUID(),issueId,quantity:'1.25',referenceNo:'WH-RET-001',recipient:'QA warehouse keeper',notes:'Unused material return'};
    const beforeHistoricalRename=await stockIdentity();
    const beforeRenamedProjectBalance=await projectBalance();
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(beforeHistoricalRename,'WH-CABLE-RENAMED','QA renamed issued warehouse cable'));
    assert.deepEqual(stockInvariant(await stockIdentity()),stockInvariant(beforeHistoricalRename));
    assert.deepEqual(await projectBalance(),beforeRenamedProjectBalance,'Editing warehouse identity must preserve project receipts');
    assert.deepEqual((await warehouseDb.query(`SELECT "warehouseItemId","materialId","boqItemId" FROM "WarehouseMovement" WHERE id=$1`,[issueId])).rows[0],{warehouseItemId:stockId,materialId:'wh-material-a',boqItemId:'wh-boq-item-a'});
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),quantity:'1'});
    assert.equal(await balance(),'7.2500','Future pickups must use the warehouse item current code, matching the BoQ');
    await post('/warehouse',returnForm,returnValues);
    assert.equal(await balance(),'8.5000');
    assert.deepEqual(await projectBalance(),{received:'2.0000',issued:'2.0000',installed:'0.0000'});
    assert.deepEqual((await warehouseDb.query(`SELECT "warehouseItemId","returnOfId" FROM "WarehouseMovement" WHERE "requestId"=$1`,[returnValues.requestId])).rows[0],{warehouseItemId:stockId,returnOfId:issueId},'Returns remain linked to the original stock item and issue after a rename');
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(await stockIdentity(),'WH-CABLE','QA warehouse cable'));
    await post('/warehouse',returnForm,returnValues);
    assert.equal(await balance(),'8.5000');
    assert.equal(await movementCount(returnValues.requestId),1);
    await post('/warehouse',returnForm,{...returnValues,requestId:randomUUID(),quantity:'2.5'});
    assert.equal(await balance(),'8.5000','Return cannot exceed the unreturned part of its original issue');
    await warehouseDb.query(`UPDATE "Material" SET "installedQty"=2 WHERE id='wh-material-a'`);
    await post('/warehouse',returnForm,{...returnValues,requestId:randomUUID(),quantity:'1'});
    assert.equal(await balance(),'8.5000','Installed material is not available for return');
    await warehouseDb.query(`UPDATE "Material" SET "installedQty"=0 WHERE id='wh-material-a'`);
    await post('/warehouse',returnForm,{...returnValues,requestId:randomUUID(),quantity:'2'});
    assert.equal(await balance(),'10.5000');
    assert.deepEqual(await projectBalance(),{received:'0.0000',issued:'0.0000',installed:'0.0000'});
    const concurrentA={...issue,requestId:randomUUID(),materialId:'wh-material-a',quantity:'5',referenceNo:'WH-RACE-A'};
    const concurrentB={...issue,requestId:randomUUID(),materialId:'wh-material-b',quantity:'6',referenceNo:'WH-RACE-B'};
    const raceForms=[await whAction('issueWarehouseStock'),await whAction('issueWarehouseStock')];
    await Promise.all([post('/warehouse',raceForms[0],concurrentA),post('/warehouse',raceForms[1],concurrentB)]);
    const raceMovements=(await warehouseDb.query(`SELECT id,"projectId","materialId",quantity::text AS quantity FROM "WarehouseMovement" WHERE "requestId"=ANY($1::text[])`,[[concurrentA.requestId,concurrentB.requestId]])).rows;
    assert.equal(raceMovements.length,1,'Only one competing withdrawal can spend the available stock');
    assert.ok(['4.5000','5.5000'].includes(await balance()));
    const historical=raceMovements[0];
    await warehouseDb.query(`UPDATE "Project" SET status='CLOSED',phase='CLOSED',"progressPct"=100,"actualFinish"=current_date,"deletedAt"=now() WHERE id=$1`,[historical.projectId]);
    await warehouseDb.query(`UPDATE "Material" SET "isActive"=false WHERE id=$1`,[historical.materialId]);
    await warehouseDb.query(`UPDATE "Boq" SET status='SUPERSEDED' WHERE "projectId"=$1`,[historical.projectId]);
    const beforeHistorical=Number(await balance());
    await post('/warehouse',returnForm,{...returnValues,requestId:randomUUID(),issueId:String(historical.id),quantity:'1',referenceNo:'WH-RET-HISTORICAL'});
    assert.equal(Number(await balance()),beforeHistorical+1,'Unused material can be returned after its project/BoQ is archived');
    const issuedBefore=String((await warehouseDb.query(`SELECT "warehouseIssuedQty"::text AS issued FROM "Material" WHERE id=$1`,[historical.materialId])).rows[0].issued);
    await post('/warehouse',issueForm,{...issue,requestId:randomUUID(),materialId:String(historical.materialId),quantity:'1'});
    assert.equal(String((await warehouseDb.query(`SELECT "warehouseIssuedQty"::text AS issued FROM "Material" WHERE id=$1`,[historical.materialId])).rows[0].issued),issuedBefore);
    await login('smoke-admin');
    const adminWarehouse=await(await request('/warehouse')).text();
    assert.ok(adminWarehouse.includes('QA warehouse cable'));
    const beforeAdminReceipt=Number(await balance());
    await post('/warehouse',await whAction('receiveWarehouseStock'),{...receipt,requestId:randomUUID(),quantity:'1',referenceNo:'WH-IN-ADMIN'});
    assert.equal(Number(await balance()),beforeAdminReceipt+1);
    const beforeAdminEdit=await stockIdentity();
    await post('/warehouse',await whAction('updateWarehouseItem'),editValues(beforeAdminEdit,'WH-CABLE-ADMIN','QA administrator warehouse edit'));
    const adminEditedStock=await stockIdentity();
    assert.equal(adminEditedStock.code,'WH-CABLE-ADMIN');
    assert.equal(adminEditedStock.description,'QA administrator warehouse edit');
    assert.deepEqual(stockInvariant(adminEditedStock),stockInvariant(beforeAdminEdit),'Admin identity edits must also preserve stock');
    console.log('PASS warehouse editing: PM/Admin access, Viewer denial, safe unit corrections, minimum/low-stock updates, stale receipt units, normalized duplicates, stale/concurrent edits, immutable balances, audit, BoQ matching and returns after rename');
    console.log('PASS warehouse receipt/issue/return, exact fractional stock, BoQ linkage, retry safety, code/unit validation, history returns, Viewer denial, and concurrent stock protection');
  } finally {await warehouseDb.end();}
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
