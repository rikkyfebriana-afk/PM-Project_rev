import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma } from '../generated/prisma/client.ts';
import {
  materialStatusMatchesQuantities,
  materialUpdateSchema,
  reconcileMaterialStatus,
} from '../lib/materials/validation.ts';

const decimal = (value: string) => new Prisma.Decimal(value);

const validUpdate = {
  id: 'material-1',
  updatedAt: '2026-09-14T05:00:00.000Z',
  orderedQty: '10',
  receivedQty: '8',
  installedQty: '6',
  supplier: 'PT Supplier',
  purchaseOrderNo: 'PO-001',
  needByDate: '2026-09-20',
  estimatedArrival: '2026-09-18',
  status: 'PARTIAL',
};

test('accepts and normalizes a valid material supply update', () => {
  const parsed = materialUpdateSchema.parse(validUpdate);
  assert.equal(parsed.receivedQty, '8.0000');
  assert.equal(parsed.supplier, 'PT Supplier');
});

test('rejects installed quantity above received quantity', () => {
  const parsed = materialUpdateSchema.safeParse({
    ...validUpdate,
    installedQty: '9',
  });
  assert.equal(parsed.success, false);
});

test('rejects invalid calendar dates and excess precision', () => {
  const parsed = materialUpdateSchema.safeParse({
    ...validUpdate,
    orderedQty: '1.00001',
    needByDate: '2026-02-30',
  });
  assert.equal(parsed.success, false);
});

test('requires material status to match operational quantities', () => {
  const quantities = {
    requiredQty: decimal('10'),
    orderedQty: decimal('10'),
    receivedQty: decimal('8'),
    installedQty: decimal('6'),
  };
  assert.equal(materialStatusMatchesQuantities('PARTIAL', quantities), true);
  assert.equal(materialStatusMatchesQuantities('SHORTAGE', quantities), true);
  assert.equal(materialStatusMatchesQuantities('RECEIVED', quantities), false);
  assert.equal(materialStatusMatchesQuantities('INSTALLED', quantities), false);
});

test('reconciles terminal status when a revised BoQ increases requirement', () => {
  const quantities = {
    requiredQty: decimal('12'),
    orderedQty: decimal('10'),
    receivedQty: decimal('10'),
    installedQty: decimal('10'),
  };
  assert.equal(reconcileMaterialStatus('INSTALLED', quantities), 'PARTIAL');
  assert.equal(reconcileMaterialStatus('SHORTAGE', quantities), 'SHORTAGE');
});
