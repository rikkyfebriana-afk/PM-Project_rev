import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDays,
  calendarGroups,
  barPosition,
  monday,
  validDate,
} from '../lib/time-plan/calendar.ts';
test('calendar handles leap days, Monday alignment and bounded windows', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(monday('2026-10-02'), '2026-09-28');
  assert.equal(calendarDays('2026-12-29', 1)[6], '2027-01-04');
  assert.equal(calendarDays('2026-01-01', 100).length, 182);
});
test('calendar groups partial weeks and months without dropping days', () => {
  const days = calendarDays('2026-09-30', 2);
  for (const mode of ['week', 'month'] as const)
    assert.equal(
      calendarGroups(days, mode).reduce((n, g) => n + g.count, 0),
      14,
    );
  assert.deepEqual(
    calendarGroups(days, 'month').map((g) => g.count),
    [1, 13],
  );
});
test('bars clip plan and earned progress against the visible window', () => {
  assert.deepEqual(
    barPosition('2026-09-01', '2026-09-10', '50', '2026-09-04', 7),
    { left: 0, width: 7, completed: 2 },
  );
  assert.equal(
    barPosition('2026-08-01', '2026-08-03', '100', '2026-09-01', 7),
    null,
  );
  assert.deepEqual(
    barPosition('2026-09-01', '2026-09-01', '100', '2026-09-01', 7),
    { left: 0, width: 1, completed: 1 },
  );
  assert.deepEqual(
    barPosition('2026-09-04', '2026-09-20', '0', '2026-09-01', 7),
    { left: 3, width: 4, completed: 0 },
  );
});
