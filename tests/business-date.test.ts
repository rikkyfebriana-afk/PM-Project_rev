import assert from 'node:assert/strict';
import test from 'node:test';

import { dateOnlyInTimeZone } from '../lib/business-date.ts';

test('uses the configured business calendar day', () => {
  const instant = new Date('2026-09-12T18:30:00.000Z');
  assert.equal(
    dateOnlyInTimeZone(instant, 'Asia/Jakarta').toISOString(),
    '2026-09-13T00:00:00.000Z',
  );
  assert.equal(
    dateOnlyInTimeZone(instant, 'Europe/London').toISOString(),
    '2026-09-12T00:00:00.000Z',
  );
});

test('falls back to UTC for an invalid time zone', () => {
  const instant = new Date('2026-09-12T23:30:00.000Z');
  assert.equal(
    dateOnlyInTimeZone(instant, 'Invalid/Zone').toISOString(),
    '2026-09-12T00:00:00.000Z',
  );
});
