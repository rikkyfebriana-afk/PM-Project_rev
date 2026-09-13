import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCsv, escapeCsvCell } from '../lib/csv.ts';

test('neutralizes spreadsheet formulas in exported cells', () => {
  assert.equal(
    escapeCsvCell('=HYPERLINK("https://example.com")'),
    '"\'=HYPERLINK(""https://example.com"")"',
  );
  assert.equal(escapeCsvCell('+SUM(1,1)'), '"\'+SUM(1,1)"');
});

test('builds an Excel-friendly UTF-8 CSV', () => {
  const csv = buildCsv([
    ['Code', 'Project'],
    ['PCC-001', 'Panel, Main'],
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Panel, Main"/);
});
