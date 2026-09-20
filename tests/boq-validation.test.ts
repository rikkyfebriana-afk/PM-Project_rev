import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBoqImportPayload } from '../lib/boq/validation.ts';

const validPayload = {
  projectId: 'project-1',
  fileName: 'BoQ Rev 01.xlsx',
  sheetName: 'BoQ Import',
  rows: [
    {
      itemNo: '001',
      itemCode: ' mat-001 ',
      itemType: 'material',
      description: 'Panel distribusi',
      unit: 'unit',
      quantity: '3.3333',
      unitPrice: '12.35',
    },
  ],
};

test('normalizes BoQ rows and calculates line total half-up', () => {
  const parsed = validateBoqImportPayload(validPayload);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.rows[0].itemNo, '001');
  assert.equal(parsed.data.rows[0].itemCode, 'MAT-001');
  assert.equal(parsed.data.rows[0].itemType, 'MATERIAL');
  assert.equal(parsed.data.rows[0].unit, 'UNIT');
  assert.equal(parsed.data.rows[0].lineTotal, '41.17');
  assert.equal(parsed.data.totalValue, '41.17');
});

test('requires a stable code for material rows', () => {
  const parsed = validateBoqImportPayload({
    ...validPayload,
    rows: [{ ...validPayload.rows[0], itemCode: null }],
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  assert.ok(parsed.issues.some((issue) => issue.field === 'itemCode'));
});

test('allows service rows without an item code', () => {
  const parsed = validateBoqImportPayload({
    ...validPayload,
    rows: [
      {
        ...validPayload.rows[0],
        itemCode: null,
        itemType: 'SERVICE',
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test('rejects duplicate material codes case-insensitively', () => {
  const parsed = validateBoqImportPayload({
    ...validPayload,
    rows: [
      validPayload.rows[0],
      {
        ...validPayload.rows[0],
        itemNo: '002',
        itemCode: 'MAT-001',
      },
    ],
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  assert.ok(parsed.issues.some((issue) => issue.field === 'itemCode'));
});

test('rejects quantity and price precision beyond database scale', () => {
  const parsed = validateBoqImportPayload({
    ...validPayload,
    rows: [
      {
        ...validPayload.rows[0],
        quantity: '1.00001',
        unitPrice: '10.001',
      },
    ],
  });
  assert.equal(parsed.success, false);
});

test('canonical hash ignores harmless decimal and whitespace differences', () => {
  const first = validateBoqImportPayload(validPayload);
  const second = validateBoqImportPayload({
    ...validPayload,
    rows: [
      {
        ...validPayload.rows[0],
        description: '  Panel   distribusi ',
        quantity: '3.3333',
        unitPrice: '12.35',
      },
    ],
  });
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.equal(first.data.sourceHash, second.data.sourceHash);

  const normalizedFirst = validateBoqImportPayload({
    ...validPayload,
    rows: [{ ...validPayload.rows[0], quantity: '3', unitPrice: '12.5' }],
  });
  const normalizedSecond = validateBoqImportPayload({
    ...validPayload,
    rows: [{ ...validPayload.rows[0], quantity: '3.0', unitPrice: '12.50' }],
  });
  assert.equal(normalizedFirst.success, true);
  assert.equal(normalizedSecond.success, true);
  if (!normalizedFirst.success || !normalizedSecond.success) return;
  assert.equal(normalizedFirst.data.sourceHash, normalizedSecond.data.sourceHash);
});
