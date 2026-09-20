import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  parseBoqFile,
  parseBoqRows,
  safeXlsxEnvelope,
} from '../lib/boq/parser.ts';

const metadata = {
  fileName: 'boq.xlsx',
  fileSize: 1024,
  sheetName: 'BoQ Import',
  sheetNames: ['BoQ Import'],
};

const header = [
  'Item No',
  'Item Code',
  'Item Type',
  'Description',
  'Unit',
  'Quantity',
  'Unit Price',
];

test('parses a valid row and preserves text identifiers', () => {
  const parsed = parseBoqRows(
    [header, ['001', '00042', 'MATERIAL', 'Cable', 'm', 10, 12500]],
    metadata,
  );
  assert.equal(parsed.validRowCount, 1);
  assert.equal(parsed.rows[0].itemNo, '001');
  assert.equal(parsed.rows[0].itemCode, '00042');
  assert.equal(parsed.rows[0].itemType, 'MATERIAL');
  assert.equal(parsed.rows[0].lineTotal, '125000');
});

test('rejects a missing required item type column', () => {
  const parsed = parseBoqRows(
    [
      ['Item No', 'Item Code', 'Description', 'Unit', 'Quantity', 'Unit Price'],
      ['1', 'A', 'Cable', 'M', 1, 10],
    ],
    metadata,
  );
  assert.ok(
    parsed.issues.some(
      (issue) => issue.code === 'MISSING_COLUMN' && issue.field === 'itemType',
    ),
  );
});

test('rejects duplicate semantic headers', () => {
  const parsed = parseBoqRows(
    [
      [...header, 'Qty'],
      ['1', 'A', 'MATERIAL', 'Cable', 'M', 1, 10, 1],
    ],
    metadata,
  );
  assert.ok(parsed.issues.some((issue) => issue.code === 'DUPLICATE_COLUMN'));
});

test('ignores blank rows but rejects partially populated rows', () => {
  const parsed = parseBoqRows(
    [
      header,
      [null, null, null, null, null, null, null],
      ['2', null, 'MATERIAL', 'Cable', 'M', 1, 10],
    ],
    metadata,
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errorRowCount, 1);
});

test('rejects duplicate material codes and formula-like input', () => {
  const parsed = parseBoqRows(
    [
      header,
      ['1', 'mat-01', 'MATERIAL', 'Cable', 'M', 1, 10],
      ['2', 'MAT-01', 'MATERIAL', '=HYPERLINK("x")', 'M', 1, 10],
    ],
    metadata,
  );
  assert.equal(parsed.errorRowCount, 2);
  assert.ok(
    parsed.rows.some((row) =>
      row.issues.some((issue) => issue.code === 'FORMULA_INPUT'),
    ),
  );
  assert.ok(
    parsed.rows.every((row) =>
      row.issues.some((issue) => issue.code === 'DUPLICATE_ITEM_CODE'),
    ),
  );
});

test('rejects ambiguous localized price text', () => {
  const parsed = parseBoqRows(
    [header, ['1', 'MAT-1', 'MATERIAL', 'Cable', 'M', 1, '1,000']],
    metadata,
  );
  assert.equal(parsed.errorRowCount, 1);
  assert.ok(
    parsed.rows[0].issues.some(
      (issue) => issue.code === 'AMBIGUOUS_NUMBER',
    ),
  );
});

test('rejects a single three-digit separator in text quantity', () => {
  const parsed = parseBoqRows(
    [header, ['1', 'MAT-1', 'MATERIAL', 'Cable', 'M', '1.234', 10]],
    metadata,
  );
  assert.equal(parsed.errorRowCount, 1);
  assert.ok(
    parsed.rows[0].issues.some(
      (issue) => issue.code === 'AMBIGUOUS_NUMBER',
    ),
  );
});

test('recognizes the canonical downloadable XLSX template', async () => {
  const bytes = await readFile(
    new URL('../public/templates/boq-import-template.xlsx', import.meta.url),
  );
  const file = new File([bytes], 'boq-import-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseBoqFile(file);
  assert.equal(parsed.headerRow, 7);
  assert.equal(parsed.sheetName, 'BoQ Import');
  assert.equal(
    parsed.issues.some((issue) => issue.severity === 'error'),
    false,
  );
});

test('rejects malformed and oversized XLSX ZIP metadata before decompression', async () => {
  const original = await readFile(
    new URL('../public/templates/boq-import-template.xlsx', import.meta.url),
  );
  assert.equal(safeXlsxEnvelope(original), true);
  assert.equal(safeXlsxEnvelope(new Uint8Array(100)), false);

  const eocd = original.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0);
  const centralOffset = original.readUInt32LE(eocd + 16);

  const tooManyEntries = Buffer.from(original);
  tooManyEntries.writeUInt16LE(501, eocd + 8);
  tooManyEntries.writeUInt16LE(501, eocd + 10);
  assert.equal(safeXlsxEnvelope(tooManyEntries), false);

  const oversizedEntry = Buffer.from(original);
  oversizedEntry.writeUInt32LE(21 * 1024 * 1024, centralOffset + 24);
  assert.equal(safeXlsxEnvelope(oversizedEntry), false);

  const encryptedEntry = Buffer.from(original);
  encryptedEntry.writeUInt16LE(
    encryptedEntry.readUInt16LE(centralOffset + 8) | 1,
    centralOffset + 8,
  );
  assert.equal(safeXlsxEnvelope(encryptedEntry), false);

  const zip64Entry = Buffer.from(original);
  zip64Entry.writeUInt32LE(0xffffffff, centralOffset + 24);
  assert.equal(safeXlsxEnvelope(zip64Entry), false);
});
