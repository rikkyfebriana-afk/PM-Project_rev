import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

type Harness = {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  post: (
    path: string,
    body: FormData,
    values: Record<string, string>,
  ) => Promise<{ status: number; text: string }>;
  login: (username: string) => Promise<string>;
  actionStateForm: (name: string, file: string) => Promise<FormData>;
  approveViaHttp: (input: {
    boqId: string;
    expectedApprovedBoqId: string | null;
  }) => Promise<string>;
};

// Uses only the local in-memory acceptance database. No application .env is read.
export async function smokeMaterialOrders({
  request,
  post,
  login,
  actionStateForm,
}: Harness) {
  const db = new pg.Client({
    connectionString:
      'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
  });
  await db.connect();
  const action = (name: string) =>
    actionStateForm(name, 'app/actions/material-orders.ts');
  const submit = async (name: string, values: Record<string, string>) =>
    post('/materials', await action(name), values);
  const stock = async () =>
    String(
      (
        await db.query(
          `SELECT quantity::text FROM "WarehouseItem" WHERE id='order-stock'`,
        )
      ).rows[0].quantity,
    );
  const current = async () => {
    const row = (
      await db.query(
        `SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS version FROM "MaterialOrder" WHERE "warehouseItemId"='order-stock' ORDER BY "createdAt" DESC LIMIT 1`,
      )
    ).rows[0];
    assert.ok(row, 'An order should exist');
    return {
      id: String(row.id),
      updatedAt: String(row.version),
      status: String(row.status),
      received: String(row.receivedQty),
    };
  };
  try {
    await login('smoke-pm');
    await db.query(
      `INSERT INTO "WarehouseItem" (id,code,"normalizedCode",description,unit,"minQty",quantity,"updatedAt") VALUES ('order-stock','QA-RESTOCK','QA-RESTOCK','QA restock material','PCS',5,0,now()),('order-healthy','QA-HEALTHY','QA-HEALTHY','QA healthy stock','PCS',2,10,now())`,
    );
    const page = await (await request('/materials')).text();
    assert.ok(
      page.includes('Material Status Order') && page.includes('QA-RESTOCK'),
    );
    assert.ok(
      !page.includes('QA-HEALTHY'),
      'Healthy stock without open orders is excluded',
    );
    const draft = {
      requestId: randomUUID(),
      warehouseItemId: 'order-stock',
      quantity: '8.5',
      supplier: 'QA Supplier',
      referenceNo: 'QA-ORDER-1',
      expectedArrival: '2026-01-01',
      notes: 'Synthetic order acceptance fixture',
    };
    await submit('createMaterialOrder', {
      ...draft,
      warehouseItemId: 'order-healthy',
      requestId: randomUUID(),
    });
    assert.equal(
      Number(
        (
          await db.query(
            `SELECT count(*) FROM "MaterialOrder" WHERE "warehouseItemId"='order-healthy'`,
          )
        ).rows[0].count,
      ),
      0,
    );
    const createForm = await action('createMaterialOrder');
    await post('/materials', createForm, draft);
    const original = await current();
    assert.equal(original.status, 'DRAFT');
    assert.equal(await stock(), '0.0000');
    await post('/materials', createForm, draft);
    await post('/materials', createForm, { ...draft, requestId: randomUUID() });
    assert.equal(
      Number(
        (
          await db.query(
            `SELECT count(*) FROM "MaterialOrder" WHERE "warehouseItemId"='order-stock'`,
          )
        ).rows[0].count,
      ),
      1,
      'Retry and competing drafts cannot duplicate an active order',
    );
    const item = (
      await db.query(
        `SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS version FROM "WarehouseItem" WHERE id='order-stock'`,
      )
    ).rows[0];
    await post(
      '/warehouse',
      await actionStateForm('updateWarehouseItem', 'app/actions/warehouse.ts'),
      {
        id: 'order-stock',
        updatedAt: String(item.version),
        code: 'QA-RESTOCK',
        description: 'QA restock material',
        unit: 'BOX',
        minQty: '5',
      },
    );
    assert.equal(
      (
        await db.query(
          `SELECT unit FROM "WarehouseItem" WHERE id='order-stock'`,
        )
      ).rows[0].unit,
      'PCS',
      'Active draft locks warehouse unit',
    );
    const viewerForm = await action('confirmMaterialOrder');
    const viewerCreate = await action('createMaterialOrder');
    await login('smoke-viewer');
    const viewerPage = await (await request('/materials?view=orders')).text();
    assert.ok(
      !viewerPage.includes('QA-RESTOCK') && !viewerPage.includes('QA Supplier'),
    );
    const viewerDashboard = await (await request('/dashboard')).text();
    assert.ok(
      !viewerDashboard.includes('Restock Gudang') &&
        !viewerDashboard.includes('Order Material'),
    );
    await post('/materials', viewerForm, original);
    await post('/materials', viewerCreate, {
      ...draft,
      requestId: randomUUID(),
    });
    assert.equal((await current()).status, 'DRAFT');
    await login('smoke-pm');
    await submit('updateMaterialOrder', {
      ...draft,
      ...original,
      quantity: '9.5',
    });
    const edited = await current();
    await submit('confirmMaterialOrder', original);
    assert.equal(
      (await current()).status,
      'DRAFT',
      'Stale version cannot confirm edited draft',
    );
    await submit('confirmMaterialOrder', edited);
    assert.equal((await current()).status, 'ORDERED');
    const receiving = {
      requestId: randomUUID(),
      orderId: edited.id,
      expectedUnit: 'PCS',
      quantity: '2.25',
      referenceNo: 'QA-ORDER-RECEIPT',
      recipient: 'QA warehouse keeper',
      notes: 'Partial receipt',
    };
    const receiptForm = await action('receiveMaterialOrder');
    await post('/materials', receiptForm, {
      ...receiving,
      expectedUnit: 'BOX',
    });
    assert.equal(await stock(), '0.0000');
    await post('/materials', receiptForm, receiving);
    assert.equal(await stock(), '2.2500');
    assert.equal((await current()).status, 'PARTIAL');
    await post('/materials', receiptForm, receiving);
    await post('/materials', receiptForm, { ...receiving, quantity: '3' });
    assert.equal(
      await stock(),
      '2.2500',
      'Retries are idempotent and altered payloads rejected',
    );
    assert.equal(
      Number(
        (
          await db.query(
            `SELECT count(*) FROM "WarehouseMovement" WHERE "requestId"=$1 AND "materialOrderId"=$2`,
            [receiving.requestId, edited.id],
          )
        ).rows[0].count,
      ),
      1,
    );
    await submit('receiveMaterialOrder', {
      ...receiving,
      requestId: randomUUID(),
      quantity: '8',
    });
    assert.equal(
      await stock(),
      '2.2500',
      'Cannot receive more than the remaining order',
    );
    const finish = {
      ...receiving,
      requestId: randomUUID(),
      quantity: '7.25',
      referenceNo: 'QA-ORDER-COMPLETE',
    };
    const retryForms = [
      await action('receiveMaterialOrder'),
      await action('receiveMaterialOrder'),
    ];
    await Promise.all(
      retryForms.map((body) => post('/materials', body, finish)),
    );
    assert.equal(await stock(), '9.5000');
    assert.equal((await current()).status, 'RECEIVED');
    assert.equal(
      Number(
        (
          await db.query(
            `SELECT count(*) FROM "WarehouseMovement" WHERE "requestId"=$1`,
            [finish.requestId],
          )
        ).rows[0].count,
      ),
      1,
    );
    const afterReceipt = await (await request('/materials')).text();
    assert.ok(
      afterReceipt.includes('QA-ORDER-1'),
      'Completed order remains in history',
    );
    await db.query(
      `UPDATE "WarehouseItem" SET "minQty"=10,"updatedAt"=now() WHERE id='order-stock'`,
    );
    await login('smoke-admin');
    await submit('createMaterialOrder', {
      ...draft,
      requestId: randomUUID(),
      quantity: '4',
      referenceNo: 'QA-ORDER-CANCEL',
    });
    const toCancel = await current();
    await submit('confirmMaterialOrder', toCancel);
    await submit('receiveMaterialOrder', {
      ...receiving,
      requestId: randomUUID(),
      orderId: toCancel.id,
      quantity: '1',
      referenceNo: 'QA-CANCEL-PARTIAL',
    });
    const partial = await current();
    await submit('cancelMaterialOrder', {
      ...partial,
      reason: 'Supplier unable to fulfil remaining items',
    });
    assert.equal((await current()).status, 'CANCELLED');
    assert.equal(await stock(), '10.5000');
    await submit('receiveMaterialOrder', {
      ...receiving,
      requestId: randomUUID(),
      orderId: toCancel.id,
      quantity: '1',
    });
    assert.equal(
      await stock(),
      '10.5000',
      'Cancellation preserves receipts and blocks additional credit',
    );
    assert.ok(
      (await (await request('/dashboard')).text()).includes('Restock Gudang'),
    );
    console.log(
      'PASS order restock/lifecycle, PM/Admin, Viewer isolation, version/unit guards, partial/excess/concurrent receipts, idempotency and cancellation',
    );
  } finally {
    await db.end();
  }
}

export async function smokeBoqCosting({
  request,
  post,
  login,
  actionStateForm,
  approveViaHttp,
}: Harness) {
  const db = new pg.Client({
    connectionString:
      'postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable',
  });
  await db.connect();
  const snapshot = async () => {
    const row = (
      await db.query(
        `SELECT "budgetValue"::text AS budget,"actualCost"::text AS actual,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS version FROM "Project" WHERE id='cost-project'`,
      )
    ).rows[0];
    return {
      budget: String(row.budget),
      actual: String(row.actual),
      version: String(row.version),
    };
  };
  try {
    await db.query(`INSERT INTO "Project" (id,code,name,"budgetValue","actualCost","costOpeningBalance","updatedAt") VALUES ('cost-project','QA-COST','QA project HPP budget',999,77,77,now());
      INSERT INTO "Boq" (id,"projectId",version,"updatedAt") VALUES ('cost-boq','cost-project',1,now());
      INSERT INTO "BoqItem" (id,"boqId","itemNo","itemCode","itemType",description,unit,quantity,"unitPrice","lineTotal") VALUES
      ('cost-m','cost-boq','1','QA-COST-MATERIAL','MATERIAL','QA private HPP material','PCS',2.5,100,250),
      ('cost-s','cost-boq','2',NULL,'SERVICE','QA HPP service','LOT',1,50,50),
      ('cost-o','cost-boq','3',NULL,'OTHER','QA HPP other','LOT',1,25,25)`);
    await login('smoke-pm');
    assert.equal(
      (await snapshot()).budget,
      '999.00',
      'Draft does not change budget',
    );
    const costsPage = await (
      await request('/boq?projectId=cost-project&revisionId=cost-boq')
    ).text();
    assert.ok(
      costsPage.includes('QA private HPP material') &&
        costsPage.includes('HPP'),
    );
    const approved = await approveViaHttp({
      boqId: 'cost-boq',
      expectedApprovedBoqId: null,
    });
    assert.ok(approved.includes('menjadi baseline approved'));
    assert.equal(
      (await snapshot()).budget,
      '325.00',
      'Approved budget includes material, service, and other costs',
    );
    assert.equal(
      (await snapshot()).actual,
      '77.00',
      'BoQ approval must not invent actual expenses',
    );
    await db.query(
      `UPDATE "Project" SET "budgetValue"=400,"updatedAt"=now() WHERE id='cost-project'`,
    );
    await approveViaHttp({ boqId: 'cost-boq', expectedApprovedBoqId: null });
    assert.equal(
      (await snapshot()).budget,
      '400.00',
      'Already approved retries cannot replace later budget edits',
    );
    const beforeSync = await snapshot();
    const syncValues = {
      projectId: 'cost-project',
      expectedApprovedBoqId: 'cost-boq',
      expectedProjectUpdatedAt: beforeSync.version,
      expectedBudgetValue: '400.00',
      confirm: 'yes',
    };
    const sync = await actionStateForm(
      'syncBoqBudgetAction',
      'app/actions/boq-budget.ts',
    );
    await post('/boq', sync, { ...syncValues, confirm: '' });
    assert.equal(
      (await snapshot()).budget,
      '400.00',
      'Explicit adoption requires confirmation',
    );
    await post('/boq', sync, syncValues);
    assert.equal((await snapshot()).budget, '325.00');
    await db.query(
      `UPDATE "Project" SET "budgetValue"=450,"updatedAt"=now() WHERE id='cost-project'`,
    );
    await post('/boq', sync, syncValues);
    assert.equal(
      (await snapshot()).budget,
      '450.00',
      'Stale adoption cannot overwrite a newer budget',
    );
    await db.query(`UPDATE "User" SET "viewerPortfolioAccess"=false WHERE id='smoke-viewer';
      INSERT INTO "ViewerPermission" ("userId","projectId",scopes,"updatedAt") VALUES ('smoke-viewer','cost-project',ARRAY['PROJECT','MATERIALS'],now())`);
    await login('smoke-viewer');
    const viewerBoq = await (
      await request('/boq?projectId=cost-project&revisionId=cost-boq')
    ).text();
    assert.ok(
      !viewerBoq.includes('QA private HPP material'),
      'MATERIALS permission cannot expose BoQ cost items',
    );
    const viewerMaterials = await (
      await request('/boq/materials?projectId=cost-project')
    ).text();
    assert.ok(viewerMaterials.includes('QA private HPP material'));
    assert.ok(
      !viewerMaterials.includes('unitPrice') &&
        !viewerMaterials.includes('lineTotal'),
    );
    await post('/boq', sync, {
      ...syncValues,
      expectedProjectUpdatedAt: (await snapshot()).version,
      expectedBudgetValue: '450.00',
    });
    assert.equal(
      (await snapshot()).budget,
      '450.00',
      'Viewer cannot adopt BoQ budget through forged actions',
    );
    await login('smoke-admin');
    console.log(
      'PASS BoQ HPP item detail, exact subtotal budget approval, draft/retry protection, explicit legacy adoption, stale budget guards and Viewer cost isolation',
    );
  } finally {
    await db.end();
  }
}
