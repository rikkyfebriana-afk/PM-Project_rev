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
    const opening = await db.query<{ value: string }>(
      `SELECT "costOpeningBalance"::text AS value FROM "Project" WHERE "id"='legacy'`,
    );
    assert.equal(opening.rows[0].value, '100.00');
    await db.exec(`INSERT INTO "Project" ("id","code","name","updatedAt") VALUES ('p2','P2','Second',now());
    INSERT INTO "Boq" ("id","projectId","version","updatedAt") VALUES ('b1','legacy',1,now());
    INSERT INTO "BoqItem" ("id","boqId","itemNo","description","unit","quantity","unitPrice","lineTotal") VALUES ('i1','b1','1','Cable','M',10,100,1000);
    UPDATE "Boq" SET "status"='APPROVED' WHERE "id"='b1';`);
    await assert.rejects(
      db.exec(`UPDATE "BoqItem" SET "quantity"=20 WHERE "id"='i1'`),
      /immutable/,
    );
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
  } finally {
    await db.close();
  }
});
