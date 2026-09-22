import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import {
  renderExcel,
  renderPdf,
  type ReportData,
} from '../lib/reports/render.ts';
const report: ReportData = {
  title: 'Cost Ledger',
  subtitle: 'DEMO test',
  generatedAt: '2026-09-20T00:00:00.000Z',
  columns: [
    { label: 'Description', width: 36 },
    { label: 'Amount', kind: 'money', width: 24 },
    { label: 'Date', kind: 'date', width: 18 },
  ],
  rows: [
    ['=HYPERLINK("unsafe")', '1200.25', '2026-09-20'],
    ['Exact large value', '9999999999999999.99', null],
  ],
};
test('Excel report preserves literal strings, typed money, dates and large decimals', async () => {
  const bytes = await renderExcel(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  const sheet = workbook.getWorksheet('Report')!;
  assert.equal(sheet.getCell('A5').value, '=HYPERLINK("unsafe")');
  assert.equal(sheet.getCell('B5').value, 1200.25);
  assert.ok(sheet.getCell('C5').value instanceof Date);
  assert.equal(sheet.getCell('B6').value, '9999999999999999.99');
  assert.equal(sheet.views[0].state, 'frozen');
});
test('PDF reports paginate large tables and encode unusual labels without failing', async () => {
  const bytes = await renderPdf({
    ...report,
    rows: Array.from({ length: 70 }, (_, i) => [
      `Row ${i} with extended label 漢字`,
      100,
      '2026-09-20',
    ]),
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
  assert.equal(pdf.getTitle(), 'Cost Ledger');
});
