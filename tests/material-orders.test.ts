import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  materialOrderCreateSchema,
  materialOrderReceiptSchema,
  materialOrderCancelSchema,
} from '../lib/material-orders/validation.ts';

const draft = () => ({
  requestId: randomUUID(),
  warehouseItemId: 'stock',
  quantity: '2.2500',
  supplier: 'Supplier',
  referenceNo: 'ORDER-1',
  expectedArrival: '2026-11-26',
  notes: '',
});
test('material order quantity and dates use exact, bounded input', () => {
  assert.equal(materialOrderCreateSchema.parse(draft()).quantity, '2.2500');
  for (const quantity of [
    '0',
    '-1',
    '1e3',
    '1,5',
    '1.12345',
    '100000000000000',
  ])
    assert.equal(
      materialOrderCreateSchema.safeParse({ ...draft(), quantity }).success,
      false,
    );
  for (const expectedArrival of ['2026-02-30', 'tomorrow', '2026-13-01'])
    assert.equal(
      materialOrderCreateSchema.safeParse({ ...draft(), expectedArrival })
        .success,
      false,
    );
  assert.equal(
    materialOrderCreateSchema.parse({ ...draft(), expectedArrival: '' })
      .expectedArrival,
    null,
  );
});
test('material receipts require evidence, recipient, and expected unit; cancellation requires a reason', () => {
  const receipt = {
    requestId: randomUUID(),
    orderId: 'order',
    quantity: '1.5',
    expectedUnit: ' m ',
    referenceNo: 'IN-1',
    recipient: 'Warehouse keeper',
    notes: '',
  };
  assert.equal(materialOrderReceiptSchema.parse(receipt).expectedUnit, 'M');
  for (const change of [
    { referenceNo: '' },
    { recipient: '' },
    { expectedUnit: '' },
    { orderId: '' },
  ])
    assert.equal(
      materialOrderReceiptSchema.safeParse({ ...receipt, ...change }).success,
      false,
    );
  assert.equal(
    materialOrderCancelSchema.safeParse({
      id: 'order',
      updatedAt: '2026-11-26T01:00:00.000Z',
      reason: '',
    }).success,
    false,
  );
});
