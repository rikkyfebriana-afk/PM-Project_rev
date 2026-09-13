import assert from 'node:assert/strict';
import test from 'node:test';

import { projectFormSchema } from '../lib/projects/validation.ts';

const validProject = {
  code: 'pcc-100',
  name: 'New substation project',
  clientName: 'PT Example',
  status: 'ACTIVE',
  health: 'ON_TRACK',
  phase: 'PLANNING',
  progressPct: '0',
  poValue: '1250000000.50',
  budgetValue: '800000000',
  actualCost: '0',
  forecastCost: '790000000',
  address: 'Jakarta, Indonesia',
  latitude: '-6.200000',
  longitude: '106.816666',
  plannedStart: '2026-09-01',
  plannedFinish: '2027-03-31',
  actualFinish: null,
  projectManagerId: null,
};

test('normalizes a valid project code to uppercase', () => {
  const parsed = projectFormSchema.parse(validProject);
  assert.equal(parsed.code, 'PCC-100');
});

test('requires latitude and longitude as a pair', () => {
  const parsed = projectFormSchema.safeParse({
    ...validProject,
    longitude: null,
  });
  assert.equal(parsed.success, false);
});

test('rejects an inverted planned schedule', () => {
  const parsed = projectFormSchema.safeParse({
    ...validProject,
    plannedStart: '2027-04-01',
    plannedFinish: '2027-03-31',
  });
  assert.equal(parsed.success, false);
});

test('rejects a non-existent calendar date', () => {
  const parsed = projectFormSchema.safeParse({
    ...validProject,
    plannedFinish: '2027-02-30',
  });
  assert.equal(parsed.success, false);
});

test('requires a consistent closed state', () => {
  const invalid = projectFormSchema.safeParse({
    ...validProject,
    status: 'CLOSED',
    phase: 'CLOSED',
    progressPct: '98',
    actualFinish: null,
  });
  assert.equal(invalid.success, false);

  const valid = projectFormSchema.safeParse({
    ...validProject,
    status: 'CLOSED',
    phase: 'CLOSED',
    progressPct: '100',
    actualFinish: '2027-03-28',
  });
  assert.equal(valid.success, true);
});

test('rejects financial values beyond Decimal(18,2)', () => {
  const parsed = projectFormSchema.safeParse({
    ...validProject,
    poValue: '12345678901234567.89',
  });
  assert.equal(parsed.success, false);
});
