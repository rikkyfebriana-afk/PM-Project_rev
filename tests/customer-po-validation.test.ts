import test from 'node:test';
import assert from 'node:assert/strict';
import { customerPoSchema } from '../lib/customer-po/validation.ts';
const valid = {
  projectId: 'p1',
  updatedAt: '2026-09-30T00:00:00.000Z',
  customerPoNumber: 'PO/001',
  clientName: 'PT Customer',
  customerPoDate: '2026-09-30',
  customerPoDelivery: '2026-10-15',
  customerPoDescription: 'Panel listrik',
  poValue: '1000000.50',
  customerPoTax: '110000.05',
  customerPoStatus: 'RECEIVED',
  customerPoNotes: '',
};
test('customer PO accepts exact money strings and trims names', () => {
  const result = customerPoSchema.parse({
    ...valid,
    clientName: ' PT Customer ',
  });
  assert.equal(result.clientName, 'PT Customer');
  assert.equal(result.poValue, '1000000.50');
});
test('customer PO validates all dates and target ordering', () => {
  for (const patch of [
    { customerPoDate: '2026-02-30' },
    { customerPoDelivery: '2026-09-01' },
    { customerPoDate: 'not-date' },
  ])
    assert.equal(
      customerPoSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
  assert.equal(
    customerPoSchema.safeParse({ ...valid, customerPoDelivery: '' }).success,
    true,
  );
});
test('customer PO rejects missing identity, stale version format, negative and overflowing money', () => {
  for (const patch of [
    { projectId: '' },
    { updatedAt: '' },
    { customerPoNumber: '  ' },
    { clientName: '' },
    { poValue: '-1' },
    { customerPoTax: '-1' },
    { poValue: '1,000' },
    { poValue: '0.001' },
    { poValue: '10000000000000000' },
    { customerPoStatus: 'APPROVED' },
  ])
    assert.equal(
      customerPoSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
});
