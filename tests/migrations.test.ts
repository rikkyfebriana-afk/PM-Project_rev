import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('all PostgreSQL migrations apply and protect baseline, project links and cost entries', async () => {
  const db = new PGlite();
  try {
    const root = new URL('../prisma/migrations/', import.meta.url);
    const dirs = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const dir of dirs) {
      if (dir === '20260920000100_operations_finance')
        await db.exec(
          `INSERT INTO "Project" ("id","code","name","updatedAt","actualCost") VALUES ('legacy','LEGACY','Legacy project',now(),100)`,
        );
      await db.exec(
        await readFile(new URL(`${dir}/migration.sql`, root), 'utf8'),
      );
    }
    await db.exec(`INSERT INTO "User" ("id","username","normalizedUsername","displayName","passwordHash","updatedAt") VALUES ('viewer-test','viewer-test','viewer-test','Viewer test','unused',now());`);
    const defaults = await db.query<{viewerPortfolioAccess:boolean;viewerAccessVersion:number}>(`SELECT "viewerPortfolioAccess","viewerAccessVersion" FROM "User" WHERE "id"='viewer-test'`);
    assert.deepEqual(defaults.rows[0],{viewerPortfolioAccess:false,viewerAccessVersion:0});
    await db.exec(`INSERT INTO "ViewerPermission" ("userId","projectId","scopes","updatedAt") VALUES ('viewer-test','legacy',ARRAY['PROJECT','MATERIALS','BOQ'],now());`);
    await assert.rejects(db.exec(`UPDATE "ViewerPermission" SET scopes=ARRAY['PROJECT','INVALID'] WHERE "userId"='viewer-test'`),/check constraint/);
    const opening = await db.query<{ value: string }>(
      `SELECT "costOpeningBalance"::text AS value FROM "Project" WHERE "id"='legacy'`,
    );
    assert.equal(opening.rows[0].value, '100.00');
    const legacyPo = await db.query<{
      number: null;
      tax: string;
      status: string;
    }>(
      `SELECT "customerPoNumber" AS number, "customerPoTax"::text AS tax, "customerPoStatus" AS status FROM "Project" WHERE "id"='legacy'`,
    );
    assert.deepEqual(legacyPo.rows[0], {
      number: null,
      tax: '0.00',
      status: 'DRAFT',
    });
    await assert.rejects(
      db.exec(`UPDATE "Project" SET "customerPoTax"=-1 WHERE "id"='legacy'`),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        `UPDATE "Project" SET "customerPoStatus"='INVALID' WHERE "id"='legacy'`,
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        `UPDATE "Project" SET "customerPoDate"='2026-09-30',"customerPoDelivery"='2026-09-01' WHERE "id"='legacy'`,
      ),
      /check constraint/,
    );
    await db.exec(`INSERT INTO "Project" ("id","code","name","updatedAt") VALUES ('p2','P2','Second',now());
    INSERT INTO "Boq" ("id","projectId","version","updatedAt") VALUES ('b1','legacy',1,now());
    INSERT INTO "BoqItem" ("id","boqId","itemNo","description","unit","quantity","unitPrice","lineTotal") VALUES ('i1','b1','1','Cable','M',10,100,1000);
    UPDATE "Boq" SET "status"='APPROVED' WHERE "id"='b1';`);
    await assert.rejects(
      db.exec(`UPDATE "BoqItem" SET "quantity"=20 WHERE "id"='i1'`),
      /immutable/,
    );
    await db.exec(`INSERT INTO "WarehouseItem" (id,code,"normalizedCode",description,unit,quantity,"updatedAt") VALUES ('wh-db','WH-DB','WH-DB','Warehouse fixture','M',5,now());
      INSERT INTO "Material" (id,"projectId","boqItemId",description,unit,"requiredQty","receivedQty","warehouseIssuedQty",status,"updatedAt") VALUES ('wh-db-material','legacy','i1','Warehouse material fixture','M',10,5,3,'PARTIAL',now());`);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseItem" (id,code,"normalizedCode",description,unit,"updatedAt") VALUES ('wh-duplicate','WH-DB','WH-DB','Duplicate fixture','M',now())`),/unique constraint/);
    await assert.rejects(db.exec(`UPDATE "WarehouseItem" SET quantity=-1 WHERE id='wh-db'`),/check constraint/);
    await assert.rejects(db.exec(`UPDATE "WarehouseItem" SET "minQty"=-1 WHERE id='wh-db'`),/check constraint/);
    await assert.rejects(db.exec(`UPDATE "Material" SET "receivedQty"=2 WHERE id='wh-db-material'`),/check constraint/);
    await assert.rejects(db.exec(`UPDATE "Material" SET "warehouseIssuedQty"=-1 WHERE id='wh-db-material'`),/check constraint/);
    await db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient) VALUES ('wh-db-receipt','wh-db-request','fixture','viewer-test','RECEIPT',2,7,'wh-db','WH-IN-DB','Fixture keeper');`);
    await assert.rejects(db.exec(`UPDATE "WarehouseMovement" SET quantity=3 WHERE id='wh-db-receipt'`),/immutable/);
    await assert.rejects(db.exec(`DELETE FROM "WarehouseMovement" WHERE id='wh-db-receipt'`),/immutable/);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient) VALUES ('wh-db-zero','wh-db-zero','fixture','viewer-test','RECEIPT',0,7,'wh-db','WH-ZERO','Fixture keeper')`),/check constraint/);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient) VALUES ('wh-db-negative','wh-db-negative','fixture','viewer-test','RECEIPT',1,-1,'wh-db','WH-NEGATIVE','Fixture keeper')`),/check constraint/);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient) VALUES ('wh-db-duplicate','wh-db-request','fixture','viewer-test','RECEIPT',2,7,'wh-db','WH-DUPLICATE','Fixture keeper')`),/unique constraint/);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient) VALUES ('wh-db-invalid-issue','wh-db-invalid-issue','fixture','viewer-test','ISSUE',1,4,'wh-db','WH-OUT','Fixture keeper')`),/check constraint/);
    await assert.rejects(db.exec(`INSERT INTO "WarehouseMovement" (id,"requestId","payloadHash","actorId",type,quantity,"balanceAfter","warehouseItemId","referenceNo",recipient,"projectId","materialId","boqItemId") VALUES ('wh-db-foreign-issue','wh-db-foreign-issue','fixture','viewer-test','ISSUE',1,4,'wh-db','WH-OUT','Fixture keeper','p2','wh-db-material','i1')`),/foreign key constraint/);
    await assert.rejects(
      db.exec(
        `INSERT INTO "BoqItem" ("id","boqId","itemNo","description","unit","quantity","unitPrice","lineTotal") VALUES ('i2','b1','2','Cable','M',1,100,100)`,
      ),
      /immutable/,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "Material" ("id","projectId","boqItemId","description","unit","requiredQty","updatedAt") VALUES ('m1','p2','i1','Wrong project','M',10,now())`,
      ),
      /same project/,
    );
    await db.exec(
      `INSERT INTO "Milestone" ("id","projectId","title","plannedDate","updatedAt") VALUES ('ms1','legacy','FAT','2026-09-25',now())`,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "ActionItem" ("id","projectId","milestoneId","title","updatedAt") VALUES ('a1','p2','ms1','Wrong project',now())`,
      ),
      /same project/,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "CostEntry" ("id","projectId","requestId","category","description","amount","spentAt") VALUES ('c1','legacy','req1','MATERIAL','Invalid',-1,'2026-09-20')`,
      ),
      /check constraint/,
    );
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(
      `INSERT INTO "PlanTask" ("id","projectId","phase","title","responsible","weight","plannedStart","plannedFinish","updatedAt") VALUES ('t1','legacy','ENGINEERING','Drawing','QA',20,'2026-09-01','2026-09-02',now()),('t2','p2','ENGINEERING','Foreign','QA',20,'2026-09-03','2026-09-04',now())`,
    );
    await assert.rejects(
      db.exec(`UPDATE "PlanTask" SET "predecessorId"='t1' WHERE "id"='t2'`),
      /foreign key constraint/,
    );
    await assert.rejects(
      db.exec(`UPDATE "PlanTask" SET "weight"=101 WHERE "id"='t1'`),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(`UPDATE "PlanTask" SET "progressPct"=100 WHERE "id"='t1'`),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        `UPDATE "PlanTask" SET "plannedFinish"='2026-08-01' WHERE "id"='t1'`,
      ),
      /check constraint/,
    );
    await db.exec(
      await readFile(
        new URL('../scripts/supabase-security.sql', import.meta.url),
        'utf8',
      ),
    );
    const security = await db.query<{
      tablename: string;
      rowsecurity: boolean;
    }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'`,
    );
    assert.equal(security.rows.length, 18);
    assert.ok(security.rows.every((row) => row.rowsecurity));
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public."WarehouseItem"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."WarehouseMovement"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."ViewerPermission"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."DailyTarget"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."Quotation"'), /permission denied/);
    await assert.rejects(
      db.query('SELECT * FROM public."PlanTask"'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('SELECT * FROM public."User"'),
      /permission denied/,
    );
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await assert.rejects(db.query('SELECT * FROM public."WarehouseItem"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."WarehouseMovement"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."ViewerPermission"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."DailyTarget"'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public."Quotation"'), /permission denied/);
    await assert.rejects(
      db.query('SELECT * FROM public."Project"'),
      /permission denied/,
    );
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
});
