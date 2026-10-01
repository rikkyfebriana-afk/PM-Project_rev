import test from 'node:test';
import assert from 'node:assert/strict';
import {
  taskSchema,
  summarizeTasks,
  validatePlan,
  taskStatus,
  type TaskValue,
} from '../lib/time-plan/model.ts';
const base: TaskValue = {
  id: 'one',
  title: 'Wiring',
  phase: 'PRODUCTION',
  weight: '20',
  progressPct: '50',
  plannedStart: '2026-09-01',
  plannedFinish: '2026-09-02',
  actualStart: '2026-09-01',
  actualFinish: '',
  predecessorId: '',
};
test('weights contribute to project and phases with exact decimal arithmetic', () => {
  const result = summarizeTasks([
    base,
    { ...base, id: 'two', weight: '80', progressPct: '25' },
  ]);
  assert.equal(result.totalWeight, '100.00');
  assert.equal(result.progress, '30.00');
  assert.equal(result.ready, true);
  assert.equal(result.stages[0].progress, '30.00');
  const exact = summarizeTasks(
    ['33.33', '33.33', '33.34'].map((weight, i) => ({
      ...base,
      id: String(i),
      weight,
      progressPct: '100',
    })),
  );
  assert.equal(exact.totalWeight, '100.00');
  assert.equal(exact.progress, '100.00');
  assert.equal(summarizeTasks([]).ready, false);
  assert.equal(summarizeTasks([base]).ready, false);
});
test('rounding cannot report completed project while any weighted work remains', () => {
  const result = summarizeTasks([
    { ...base, weight: '99.99', progressPct: '100' },
    { ...base, id: 'tiny', weight: '0.01', progressPct: '99.99' },
  ]);
  assert.equal(result.progress, '99.99');
  assert.equal(result.stages[0].progress, '99.99');
});
test('task schema rejects inconsistent actual dates, invalid weights, and calendar dates', () => {
  const input = {
    ...base,
    projectId: 'project',
    updatedAt: '2026-10-01T00:00:00.000Z',
    responsible: 'QA team',
    sortOrder: '1',
    notes: '',
  };
  assert.equal(taskSchema.safeParse(input).success, true);
  for (const patch of [
    { weight: '0' },
    { weight: '100.01' },
    { weight: '1.001' },
    { progressPct: '101' },
    { actualStart: '' },
    { actualFinish: '2026-09-02' },
    { progressPct: '100' },
    { plannedStart: '2026-02-30' },
    { plannedFinish: '2026-08-01' },
  ])
    assert.equal(
      taskSchema.safeParse({ ...input, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
  assert.equal(
    taskSchema.safeParse({
      ...input,
      progressPct: '100',
      actualFinish: '2026-09-02',
    }).success,
    true,
  );
});
test('dependency graph rejects foreign tasks, cycles and impossible order', () => {
  assert.throws(
    () => validatePlan([{ ...base, predecessorId: 'foreign' }], '2026-10-01'),
    /proyek yang sama/,
  );
  assert.throws(
    () => validatePlan([{ ...base, predecessorId: 'one' }], '2026-10-01'),
    /siklus/,
  );
  assert.throws(
    () =>
      validatePlan(
        [
          { ...base, predecessorId: 'two' },
          { ...base, id: 'two', predecessorId: 'one' },
        ],
        '2026-10-01',
      ),
    /siklus/,
  );
  const predecessor = {
    ...base,
    progressPct: '100',
    actualFinish: '2026-09-02',
  };
  assert.throws(
    () =>
      validatePlan(
        [predecessor, { ...base, id: 'two', predecessorId: 'one' }],
        '2026-10-01',
      ),
    /Rencana mulai/,
  );
  const successor = {
    ...base,
    id: 'two',
    predecessorId: 'one',
    plannedStart: '2026-09-03',
    plannedFinish: '2026-09-04',
    actualStart: '2026-09-03',
  };
  assert.doesNotThrow(() =>
    validatePlan([predecessor, successor], '2026-10-01'),
  );
  assert.throws(
    () => validatePlan([base, successor], '2026-10-01'),
    /Selesaikan pendahulu/,
  );
});
test('plan rejects excess weight and future actual dates; overdue depends on completion', () => {
  assert.throws(
    () =>
      validatePlan(
        [
          { ...base, weight: '70' },
          { ...base, id: 'two', weight: '40' },
        ],
        '2026-10-01',
      ),
    /100%/,
  );
  assert.throws(
    () => validatePlan([{ ...base, actualStart: '2026-10-02' }], '2026-10-01'),
    /masa depan/,
  );
  assert.equal(taskStatus(base, '2026-10-01'), 'Terlambat');
  assert.equal(
    taskStatus({ ...base, progressPct: '100' }, '2026-10-01'),
    'Selesai',
  );
});
