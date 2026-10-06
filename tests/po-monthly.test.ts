import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyPo } from '../lib/dashboard/po-monthly.ts';
import { customerPoSchema } from '../lib/customer-po/validation.ts';
const p = {
  customerPoNumber: 'PO-1',
  customerPoStatus: 'COMPLETED',
  customerPoDate: '2025-12-31',
  customerPoCompletedDate: '2026-02-01',
  poValue: '123.45',
};
test('PO received and completed use separate months and years, with twelve zero-filled buckets', () => {
  const result = buildMonthlyPo([p], 2026);
  assert.equal(result.years[0].months[1].completedCount, 1);
  assert.equal(result.years[0].months[1].completedValue, '123.45');
  assert.equal(result.years[1].months[11].incomingCount, 1);
  assert.equal(result.years[0].months[1].incomingCount, 0);
  assert.equal(
    result.years.every((y) => y.months.length === 12),
    true,
  );
});
test('missing dates stay unknown, drafts and cancelled are excluded, reopened PO no longer counts completed', () => {
  const r = buildMonthlyPo(
    [
      { ...p, customerPoCompletedDate: null },
      { ...p, customerPoStatus: 'DRAFT' },
      { ...p, customerPoStatus: 'CANCELLED' },
      { ...p, customerPoStatus: 'IN_PROGRESS' },
      { ...p, customerPoNumber: null },
    ],
    2026,
  );
  assert.equal(r.missingCompleted, 1);
  assert.equal(r.excluded, 3);
  assert.equal(
    r.years[0].months.reduce((n, m) => n + m.completedCount, 0),
    0,
  );
  assert.equal(r.years[1].months[11].incomingCount, 2);
});
test('monthly money aggregation preserves exact cents', () => {
  const r = buildMonthlyPo(
    [
      { ...p, poValue: '9999999999999999.99' },
      { ...p, poValue: '0.01' },
    ],
    2026,
  );
  assert.equal(r.years[0].months[1].completedValue, '10000000000000000.00');
});
test('PO completion date is required for complete status and must follow PO date', () => {
  const form = {
    ...p,
    projectId: 'p',
    updatedAt: '2026-10-01T00:00:00.000Z',
    clientName: 'Client',
    customerPoDescription: 'Panel',
    customerPoTax: '0',
    customerPoDelivery: '',
    customerPoNotes: '',
  };
  assert.equal(customerPoSchema.safeParse(form).success, true);
  for (const patch of [
    { customerPoCompletedDate: '' },
    { customerPoCompletedDate: '2025-12-01' },
    { customerPoCompletedDate: '2026-02-30' },
    { customerPoStatus: 'RECEIVED' },
  ])
    assert.equal(
      customerPoSchema.safeParse({ ...form, ...patch }).success,
      false,
    );
});
