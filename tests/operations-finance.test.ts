import test from 'node:test';
import assert from 'node:assert/strict';
import { operationSchema, actionSchema } from '../lib/operations/validation.ts';
import { costSchema } from '../lib/finance/validation.ts';
const milestone = {
  id: '',
  updatedAt: '',
  projectId: 'p1',
  phase: 'FAT',
  title: 'Functional test',
  plannedDate: '2026-09-25',
  progressPct: '80',
  status: 'UPCOMING',
  notes: '',
  referenceNo: '',
  responsible: '',
};
test('completion and progress must agree in both directions', () => {
  assert.equal(
    operationSchema.safeParse({ ...milestone, status: 'COMPLETED' }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({ ...milestone, progressPct: '100' }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({
      ...milestone,
      status: 'COMPLETED',
      progressPct: '100',
    }).success,
    true,
  );
});
test('operations reject invalid calendar dates and stale version inputs', () => {
  assert.equal(
    operationSchema.safeParse({ ...milestone, plannedDate: '2026-02-30' })
      .success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({ ...milestone, id: 'existing' }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      id: 'a1',
      updatedAt: '',
      projectId: 'p1',
      milestoneId: '',
      title: 'Fix relay',
      description: '',
      priority: 'HIGH',
      status: 'OPEN',
      dueAt: '',
    }).success,
    false,
  );
});
test('cost entries require positive amounts, exact precision and idempotency key', () => {
  const cost = {
    projectId: 'p1',
    requestId: 'fd6d27fa-8ad5-4f32-81ad-e72b2743d5a6',
    category: 'MATERIAL',
    description: 'Panel cost',
    referenceNo: 'INV1',
    amount: '1250.25',
    spentAt: '2026-09-20',
  };
  assert.equal(costSchema.safeParse(cost).success, true);
  for (const amount of ['0', '-1', '1.001', '10000000000000000'])
    assert.equal(costSchema.safeParse({ ...cost, amount }).success, false);
  assert.equal(costSchema.safeParse({ ...cost, requestId: '' }).success, false);
});
