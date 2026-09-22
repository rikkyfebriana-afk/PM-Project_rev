import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ReportColumn = {
  label: string;
  kind?: 'money' | 'number' | 'date';
  width: number;
};
export type ReportData = {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: (string | number | null)[][];
  generatedAt: string;
};
export async function renderExcel(report: ReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project Control Center';
  workbook.created = new Date(report.generatedAt);
  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = report.columns.map((c) => ({ width: c.width }));
  sheet.mergeCells(1, 1, 1, report.columns.length);
  sheet.getCell(1, 1).value = report.title;
  sheet.getCell(1, 1).font = {
    size: 18,
    bold: true,
    color: { argb: 'FF17364A' },
  };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, report.columns.length);
  sheet.getCell(2, 1).value = `${report.subtitle} | ${report.generatedAt}`;
  sheet.getRow(2).height = 32;
  sheet.getCell(2, 1).alignment = { wrapText: true, vertical: 'middle' };
  sheet.getRow(4).values = report.columns.map((c) => c.label);
  sheet.getRow(4).height = 30;
  sheet.getRow(4).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17364A' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });
  for (const values of report.rows) {
    const row = sheet.addRow(
      values.map((v, i) => {
        if (v === null) return '';
        if (report.columns[i].kind === 'date' && v)
          return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
        if (
          ['number', 'money'].includes(report.columns[i].kind ?? '') &&
          String(v).replace(/[-.]/g, '').length <= 15
        )
          return Number(v);
        return String(v);
      }),
    );
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(
      30,
      ...values.map(
        (v, i) =>
          Math.ceil(String(v ?? '').length / (report.columns[i].width - 2)) *
            15 +
          8,
      ),
    );
    row.eachCell((cell, i) => {
      cell.font = { size: 11, color: { argb: 'FF243C4B' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE2E6' } } };
      if (report.columns[i - 1].kind === 'money') cell.numFmt = '"Rp" #,##0.00';
      if (report.columns[i - 1].kind === 'date') cell.numFmt = 'dd mmm yyyy';
    });
  }
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, sheet.rowCount), column: report.columns.length },
  };
  sheet.pageSetup.printTitlesRow = '1:4';
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function renderPdf(report: ReportData) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title);
  pdf.setAuthor('Project Control Center');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let replaced = false;
  const safe = (v: unknown) =>
    Array.from(
      String(v ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[–—]/g, '-'),
    )
      .map((ch) => {
        try {
          regular.encodeText(ch);
          return ch;
        } catch {
          replaced = true;
          return '?';
        }
      })
      .join('');
  const width = 842,
    height = 595,
    margin = 32,
    totalWidth = width - margin * 2;
  const unit = totalWidth / report.columns.reduce((s, c) => s + c.width, 0);
  const widths = report.columns.map((c) => c.width * unit);
  const wrap = (text: string, max: number, size = 8) => {
    const lines: string[] = [];
    let line = '';
    for (const char of safe(text)) {
      if (regular.widthOfTextAtSize(line + char, size) > max && line) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    lines.push(line);
    return lines;
  };
  let page = pdf.addPage([width, height]);
  let y = 0;
  const header = () => {
    page.drawText(safe(report.title), {
      x: margin,
      y: height - 40,
      font: bold,
      size: 18,
      color: rgb(0.09, 0.21, 0.29),
    });
    page.drawText(safe(report.subtitle), {
      x: margin,
      y: height - 60,
      font: regular,
      size: 8,
    });
    page.drawText(`Generated ${report.generatedAt}`, {
      x: margin,
      y: height - 74,
      font: regular,
      size: 8,
      color: rgb(0.4, 0.45, 0.5),
    });
    y = height - 100;
    let x = margin;
    report.columns.forEach((c, i) => {
      page.drawRectangle({
        x,
        y: y - 28,
        width: widths[i],
        height: 28,
        color: rgb(0.09, 0.21, 0.29),
      });
      wrap(c.label, widths[i] - 10)
        .slice(0, 2)
        .forEach((line, j) =>
          page.drawText(line, {
            x: x + 5,
            y: y - 11 - j * 10,
            font: bold,
            size: 8,
            color: rgb(1, 1, 1),
          }),
        );
      x += widths[i];
    });
    y -= 28;
  };
  header();
  for (const values of report.rows) {
    const cells = values.map((v, i) => wrap(String(v ?? ''), widths[i] - 10));
    const rowHeight = Math.max(24, ...cells.map((c) => c.length * 11 + 10));
    if (y - rowHeight < 48) {
      page = pdf.addPage([width, height]);
      header();
    }
    let x = margin;
    cells.forEach((lines, i) => {
      lines.forEach((line, j) =>
        page.drawText(line, {
          x: x + 5,
          y: y - 14 - j * 11,
          font: regular,
          size: 8,
        }),
      );
      x += widths[i];
    });
    y -= rowHeight;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      color: rgb(0.85, 0.89, 0.91),
      thickness: 0.5,
    });
  }
  if (!report.rows.length)
    page.drawText('Tidak ada data untuk filter ini.', {
      x: margin,
      y: y - 24,
      font: regular,
      size: 10,
    });
  pdf.getPages().forEach((p, i) => {
    p.drawText(`${i + 1} / ${pdf.getPageCount()} - Project Control Center`, {
      x: margin,
      y: 22,
      font: regular,
      size: 8,
      color: rgb(0.4, 0.45, 0.5),
    });
    if (replaced)
      p.drawText('Karakter non-Latin tersedia utuh di Excel.', {
        x: 480,
        y: 22,
        font: regular,
        size: 8,
      });
  });
  return pdf.save();
}
