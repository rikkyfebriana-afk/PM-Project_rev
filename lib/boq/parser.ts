import type {
  BoqColumnMap,
  BoqImportField,
  BoqImportIssue,
  BoqImportPreviewRow,
  BoqParsedWorkbook,
} from './import-types.ts';
import type { WorkBook, WorkSheet } from 'xlsx';
import {
  BOQ_ALLOWED_EXTENSIONS,
  BOQ_MAX_FILE_SIZE,
  boqItemTypes,
  MAX_BOQ_IMPORT_ROWS as BOQ_MAX_IMPORT_ROWS,
  type BoqItemTypeValue,
} from './types.ts';

const HEADER_SCAN_ROWS = 30;
const MAX_ZIP_ENTRIES = 500;
const MAX_ZIP_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;

export function safeXlsxEnvelope(bytes: Uint8Array) {
  if (bytes.length < 22) return false;
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const minimum = Math.max(0, bytes.length - 22 - 65_535);
  let end = -1;
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) return false;
  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const entriesOnDisk = view.getUint16(end + 8, true);
  const entries = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entries ||
    entries === 0 ||
    entries > MAX_ZIP_ENTRIES ||
    centralOffset + centralSize > end
  ) {
    return false;
  }

  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entries; index += 1) {
    if (
      cursor + 46 > end ||
      view.getUint32(cursor, true) !== 0x02014b50
    ) {
      return false;
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    if (
      (flags & 1) !== 0 ||
      (method !== 0 && method !== 8) ||
      compressed === 0xffffffff ||
      uncompressed === 0xffffffff ||
      uncompressed > MAX_ZIP_ENTRY_BYTES
    ) {
      return false;
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) return false;
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return cursor === centralOffset + centralSize;
}

const fieldLabels: Record<BoqImportField, string> = {
  itemNo: 'Item No',
  itemCode: 'Item Code',
  itemType: 'Item Type',
  description: 'Description',
  unit: 'Unit',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
};

const requiredFields: BoqImportField[] = [
  'itemNo',
  'itemType',
  'description',
  'unit',
  'quantity',
  'unitPrice',
];

const headerAliases: Record<BoqImportField, string[]> = {
  itemNo: [
    'item no',
    'item number',
    'no item',
    'nomor item',
    'nomor',
    'no',
    'line no',
  ],
  itemCode: [
    'item code',
    'kode item',
    'material code',
    'kode material',
    'part number',
    'part no',
    'sku',
  ],
  itemType: ['item type', 'type', 'tipe item', 'jenis item', 'category'],
  description: [
    'description',
    'item description',
    'material description',
    'deskripsi',
    'uraian',
    'nama item',
    'nama material',
    'nama barang',
  ],
  unit: ['unit', 'uom', 'satuan'],
  quantity: ['quantity', 'qty', 'volume', 'jumlah', 'kuantitas'],
  unitPrice: [
    'unit price',
    'unit price idr',
    'price unit',
    'unit rate',
    'harga satuan',
    'harga unit',
    'rate',
    'price',
  ],
};

const emptyColumnMap = (): BoqColumnMap => ({
  itemNo: null,
  itemCode: null,
  itemType: null,
  description: null,
  unit: null,
  quantity: null,
  unitPrice: null,
});

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[_/\\|()[\]{}.,:;\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headerMapForRow(row: unknown[]): BoqColumnMap {
  const map = emptyColumnMap();
  row.forEach((cell, columnIndex) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const field of Object.keys(headerAliases) as BoqImportField[]) {
      if (map[field] === null && headerAliases[field].includes(normalized)) {
        map[field] = columnIndex;
        break;
      }
    }
  });
  return map;
}

function headerScore(map: BoqColumnMap) {
  return (Object.values(map) as Array<number | null>).filter(
    (value) => value !== null,
  ).length;
}

function duplicateHeaderFields(row: unknown[]) {
  const counts = new Map<BoqImportField, number>();
  row.forEach((cell) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const field of Object.keys(headerAliases) as BoqImportField[]) {
      if (headerAliases[field].includes(normalized)) {
        counts.set(field, (counts.get(field) ?? 0) + 1);
        break;
      }
    }
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([field]) => field);
}

function findHeader(rows: unknown[][]) {
  let best: { index: number; map: BoqColumnMap; score: number } | undefined;

  rows.slice(0, HEADER_SCAN_ROWS).forEach((row, index) => {
    const map = headerMapForRow(row);
    const score = headerScore(map);
    if (!best || score > best.score) best = { index, map, score };
  });

  return best && best.score >= 3 ? best : null;
}

function textValue(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decimalPlaces(value: number) {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  for (let places = 0; places <= 8; places += 1) {
    const multiplier = 10 ** places;
    if (Math.abs(Math.round(value * multiplier) - value * multiplier) < 1e-8) {
      return places;
    }
  }
  return 9;
}

function trimDecimal(value: string) {
  return value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;
}

function normalizeNumericText(raw: string) {
  let value = raw
    .trim()
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/^rp\.?/i, '');

  if (!value) return { error: 'empty' as const };
  if (/^\(.*\)$/.test(value)) value = `-${value.slice(1, -1)}`;
  if (!/^[+-]?[0-9.,]+$/.test(value)) return { error: 'invalid' as const };

  const sign = value.startsWith('-') ? '-' : '';
  value = value.replace(/^[+-]/, '');
  const commaCount = (value.match(/,/g) ?? []).length;
  const dotCount = (value.match(/\./g) ?? []).length;
  let integerPart = value;
  let fractionPart = '';

  if (commaCount && dotCount) {
    const decimalSeparator =
      value.lastIndexOf(',') > value.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const decimalIndex = value.lastIndexOf(decimalSeparator);
    integerPart = value
      .slice(0, decimalIndex)
      .split(thousandsSeparator)
      .join('');
    fractionPart = value.slice(decimalIndex + 1);
    if (
      integerPart.includes(decimalSeparator) ||
      fractionPart.includes(decimalSeparator)
    ) {
      return { error: 'invalid' as const };
    }
  } else if (commaCount || dotCount) {
    const separator = commaCount ? ',' : '.';
    const parts = value.split(separator);
    const looksLikeThousands =
      parts.length > 2 && parts.slice(1).every((part) => part.length === 3);

    if (looksLikeThousands) {
      integerPart = parts.join('');
    } else if (parts.length === 2) {
      const [left, right] = parts;
      if (!left || !right) return { error: 'invalid' as const };

      if (right.length === 3) {
        return { error: 'ambiguous' as const };
      } else {
        integerPart = left;
        fractionPart = right;
      }
    } else {
      return { error: 'invalid' as const };
    }
  }

  if (
    !/^\d+$/.test(integerPart) ||
    (fractionPart && !/^\d+$/.test(fractionPart))
  ) {
    return { error: 'invalid' as const };
  }

  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const normalized = `${sign}${normalizedInteger}${fractionPart ? `.${fractionPart}` : ''}`;
  return { value: trimDecimal(normalized), scale: fractionPart.length };
}

function parseDecimal(
  value: unknown,
  maxScale: number,
  field: 'quantity' | 'unitPrice',
): { value: string; issues: BoqImportIssue[] } {
  const issues: BoqImportIssue[] = [];
  const label = fieldLabels[field];

  if (value === null || value === undefined || textValue(value) === '') {
    return {
      value: '',
      issues: [
        {
          code: 'EMPTY_VALUE',
          severity: 'error',
          field,
          message: `${label} wajib diisi.`,
        },
      ],
    };
  }

  let normalized = '';
  let scale = 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      issues.push({
        code: 'INVALID_NUMBER',
        severity: 'error',
        field,
        message: `${label} harus berupa angka.`,
      });
      return { value: '', issues };
    }
    scale = decimalPlaces(value);
    normalized = trimDecimal(value.toFixed(Math.min(scale, 8)));
  } else {
    const parsed = normalizeNumericText(textValue(value));
    if ('error' in parsed) {
      issues.push({
        code:
          parsed.error === 'ambiguous'
            ? 'AMBIGUOUS_NUMBER'
            : parsed.error === 'empty'
              ? 'EMPTY_VALUE'
              : 'INVALID_NUMBER',
        severity: 'error',
        field,
        message:
          parsed.error === 'ambiguous'
            ? `${label} ambigu. Gunakan sel angka Excel atau format desimal yang jelas.`
            : `${label} harus berupa angka.`,
      });
      return { value: '', issues };
    }
    normalized = parsed.value;
    scale = parsed.scale;
  }

  if (normalized.startsWith('-')) {
    issues.push({
      code: 'NEGATIVE_NUMBER',
      severity: 'error',
      field,
      message: `${label} tidak boleh negatif.`,
    });
  }
  if (field === 'quantity' && Number(normalized) === 0) {
    issues.push({
      code: 'INVALID_NUMBER',
      severity: 'error',
      field,
      message: 'Quantity harus lebih dari 0.',
    });
  }
  if (scale > maxScale) {
    issues.push({
      code: 'TOO_MANY_DECIMALS',
      severity: 'error',
      field,
      message: `${label} maksimal ${maxScale} angka desimal.`,
    });
  }

  return { value: normalized, issues };
}

function scaledInteger(value: string) {
  const negative = value.startsWith('-');
  const unsigned = value.replace(/^-/, '');
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const digits = BigInt(`${integer || '0'}${fraction}` || '0');
  return { value: negative ? -digits : digits, scale: fraction.length };
}

function roundedToScale(value: bigint, fromScale: number, toScale: number) {
  if (fromScale <= toScale) return value * 10n ** BigInt(toScale - fromScale);
  const divisor = 10n ** BigInt(fromScale - toScale);
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder * 2n >= divisor ? quotient + 1n : quotient;
}

function formatScaled(value: bigint, scale: number) {
  const negative = value < 0n;
  const unsigned = (negative ? -value : value)
    .toString()
    .padStart(scale + 1, '0');
  const integer = scale ? unsigned.slice(0, -scale) : unsigned;
  const fraction = scale ? unsigned.slice(-scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

function multiplyMoney(quantity: string, unitPrice: string) {
  if (!quantity || !unitPrice) return '0';
  const quantityParts = scaledInteger(quantity);
  const priceParts = scaledInteger(unitPrice);
  const product = quantityParts.value * priceParts.value;
  return formatScaled(
    roundedToScale(product, quantityParts.scale + priceParts.scale, 2),
    2,
  );
}

function addMoney(values: string[]) {
  const total = values.reduce((sum, value) => {
    const parts = scaledInteger(value);
    return sum + roundedToScale(parts.value, parts.scale, 2);
  }, 0n);
  return formatScaled(total, 2);
}

function isBlankMappedRow(row: unknown[], map: BoqColumnMap) {
  return (Object.values(map) as Array<number | null>).every(
    (column) => column === null || textValue(row[column]) === '',
  );
}

function requiredTextIssue(
  value: string,
  field: 'itemNo' | 'description' | 'unit',
): BoqImportIssue[] {
  return value
    ? []
    : [
        {
          code: 'EMPTY_VALUE',
          severity: 'error',
          field,
          message: `${fieldLabels[field]} wajib diisi.`,
        },
      ];
}

function parseRow(row: unknown[], sourceRow: number, map: BoqColumnMap) {
  const cell = (field: BoqImportField) => {
    const column = map[field];
    return column === null ? null : row[column];
  };
  const itemNo = textValue(cell('itemNo'));
  const itemCode = textValue(cell('itemCode')) || null;
  const rawItemType = textValue(cell('itemType')).toLocaleUpperCase('en-US');
  const itemType = (
    boqItemTypes.some((value) => value === rawItemType) ? rawItemType : 'OTHER'
  ) as BoqItemTypeValue;
  const description = textValue(cell('description'));
  const unit = textValue(cell('unit')).toUpperCase();
  const quantity = parseDecimal(cell('quantity'), 4, 'quantity');
  const unitPrice = parseDecimal(cell('unitPrice'), 2, 'unitPrice');
  const issues = [
    ...requiredTextIssue(itemNo, 'itemNo'),
    ...requiredTextIssue(description, 'description'),
    ...requiredTextIssue(unit, 'unit'),
    ...(!boqItemTypes.some((value) => value === rawItemType)
      ? [
          {
            code: 'INVALID_ITEM_TYPE' as const,
            severity: 'error' as const,
            field: 'itemType' as const,
            message: 'Item Type harus MATERIAL, SERVICE, atau OTHER.',
          },
        ]
      : []),
    ...(itemType === 'MATERIAL' && itemCode === null
      ? [
          {
            code: 'EMPTY_VALUE' as const,
            severity: 'error' as const,
            field: 'itemCode' as const,
            message: 'Item Code wajib untuk tipe MATERIAL.',
          },
        ]
      : []),
    ...([itemNo, itemCode, description, unit].some((value) =>
      value?.trim().startsWith('='),
    )
      ? [
          {
            code: 'FORMULA_INPUT' as const,
            severity: 'error' as const,
            message: 'Formula tidak diizinkan pada kolom input BoQ.',
          },
        ]
      : []),
    ...quantity.issues,
    ...unitPrice.issues,
  ].map((issue) => ({ ...issue, sourceRow }));

  return {
    sourceRow,
    itemNo,
    itemCode,
    itemType,
    description,
    unit,
    quantity: quantity.value,
    unitPrice: unitPrice.value,
    lineTotal: issues.some((issue) => issue.severity === 'error')
      ? '0'
      : multiplyMoney(quantity.value, unitPrice.value),
    issues,
  } satisfies BoqImportPreviewRow;
}

function addDuplicateIssues(rows: BoqImportPreviewRow[]) {
  const itemNumbers = new Map<string, number[]>();
  const itemCodes = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const itemNo = row.itemNo.toLocaleLowerCase('id-ID');
    if (itemNo)
      itemNumbers.set(itemNo, [...(itemNumbers.get(itemNo) ?? []), index]);
    const itemCode =
      row.itemType === 'MATERIAL'
        ? row.itemCode?.toLocaleUpperCase('en-US')
        : null;
    if (itemCode)
      itemCodes.set(itemCode, [...(itemCodes.get(itemCode) ?? []), index]);
  });

  itemNumbers.forEach((indexes) => {
    if (indexes.length < 2) return;
    indexes.forEach((index) => {
      rows[index].issues.push({
        code: 'DUPLICATE_ITEM_NO',
        severity: 'error',
        sourceRow: rows[index].sourceRow,
        field: 'itemNo',
        message: `Item No “${rows[index].itemNo}” muncul lebih dari sekali.`,
      });
      rows[index].lineTotal = '0';
    });
  });

  itemCodes.forEach((indexes) => {
    if (indexes.length < 2) return;
    indexes.forEach((index) => {
      rows[index].issues.push({
        code: 'DUPLICATE_ITEM_CODE',
        severity: 'error',
        sourceRow: rows[index].sourceRow,
        field: 'itemCode',
        message: `Kode material “${rows[index].itemCode}” digunakan pada beberapa baris.`,
      });
      rows[index].lineTotal = '0';
    });
  });
}

export function parseBoqRows(
  rawRows: unknown[][],
  metadata: Pick<
    BoqParsedWorkbook,
    'fileName' | 'fileSize' | 'sheetName' | 'sheetNames'
  >,
): BoqParsedWorkbook {
  const globalIssues: BoqImportIssue[] = [];
  if (!rawRows.length) {
    globalIssues.push({
      code: 'EMPTY_SHEET',
      severity: 'error',
      message: 'Sheet tidak memiliki data.',
    });
  }

  const header = findHeader(rawRows);
  if (!header) {
    globalIssues.push({
      code: 'HEADER_NOT_FOUND',
      severity: 'error',
      message:
        'Header BoQ tidak ditemukan. Gunakan kolom Item No, Description, Unit, Quantity, dan Unit Price.',
    });
  }

  const columnMap = header?.map ?? emptyColumnMap();
  if (header) {
    duplicateHeaderFields(rawRows[header.index]).forEach((field) => {
      globalIssues.push({
        code: 'DUPLICATE_COLUMN',
        severity: 'error',
        field,
        message: `Kolom ${fieldLabels[field]} muncul lebih dari sekali pada header.`,
      });
    });
    requiredFields.forEach((field) => {
      if (columnMap[field] !== null) return;
      globalIssues.push({
        code: 'MISSING_COLUMN',
        severity: 'error',
        field,
        message: `Kolom ${fieldLabels[field]} tidak ditemukan.`,
      });
    });
  }

  const mappedRows = header
    ? rawRows
        .slice(header.index + 1)
        .map((row, offset) => ({ row, sourceRow: header.index + offset + 2 }))
        .filter(({ row }) => !isBlankMappedRow(row, columnMap))
    : [];

  if (mappedRows.length > BOQ_MAX_IMPORT_ROWS) {
    globalIssues.push({
      code: 'ROW_LIMIT',
      severity: 'error',
      message: `File berisi ${mappedRows.length.toLocaleString('id-ID')} item. Maksimum ${BOQ_MAX_IMPORT_ROWS.toLocaleString('id-ID')} item per import.`,
    });
  }

  const rows = mappedRows
    .slice(0, BOQ_MAX_IMPORT_ROWS)
    .map(({ row, sourceRow }) => parseRow(row, sourceRow, columnMap));
  addDuplicateIssues(rows);

  const validRows = rows.filter(
    (row) => !row.issues.some((issue) => issue.severity === 'error'),
  );
  const errorRowCount = rows.filter((row) =>
    row.issues.some((issue) => issue.severity === 'error'),
  ).length;
  const warningRowCount = rows.filter((row) =>
    row.issues.some((issue) => issue.severity === 'warning'),
  ).length;

  return {
    ...metadata,
    headerRow: header ? header.index + 1 : null,
    columnMap,
    rows,
    issues: globalIssues,
    validRowCount: validRows.length,
    errorRowCount,
    warningRowCount,
    totalValue: addMoney(validRows.map((row) => row.lineTotal)),
  };
}

function recalculatePreview(parsed: BoqParsedWorkbook): BoqParsedWorkbook {
  const validRows = parsed.rows.filter(
    (row) => !row.issues.some((issue) => issue.severity === 'error'),
  );
  return {
    ...parsed,
    validRowCount: validRows.length,
    errorRowCount: parsed.rows.filter((row) =>
      row.issues.some((issue) => issue.severity === 'error'),
    ).length,
    warningRowCount: parsed.rows.filter((row) =>
      row.issues.some((issue) => issue.severity === 'warning'),
    ).length,
    totalValue: addMoney(validRows.map((row) => row.lineTotal)),
  };
}

function applyWorksheetGuards(
  parsed: BoqParsedWorkbook,
  worksheet: WorkSheet,
  workbook: WorkBook,
  XLSX: typeof import('xlsx'),
) {
  const issues = [...parsed.issues];
  const mappedColumns = (
    Object.values(parsed.columnMap) as Array<number | null>
  ).filter((column): column is number => column !== null);
  const workbookSheet = workbook.Workbook?.Sheets?.find(
    (sheet) => sheet.name === parsed.sheetName,
  );

  if (workbookSheet?.Hidden) {
    issues.push({
      code: 'HIDDEN_DATA',
      severity: 'error',
      message: 'Sheet tersembunyi tidak dapat digunakan sebagai sumber impor.',
    });
  }

  const hiddenColumns = worksheet['!cols'] ?? [];
  if (mappedColumns.some((column) => hiddenColumns[column]?.hidden)) {
    issues.push({
      code: 'HIDDEN_DATA',
      severity: 'error',
      message: 'Kolom input tersembunyi harus ditampilkan sebelum impor.',
    });
  }

  const firstDataRow = parsed.headerRow ?? 0;
  const merges = worksheet['!merges'] ?? [];
  if (
    merges.some(
      (merge) =>
        merge.e.r >= firstDataRow &&
        mappedColumns.some(
          (column) => column >= merge.s.c && column <= merge.e.c,
        ),
    )
  ) {
    issues.push({
      code: 'MERGED_DATA',
      severity: 'error',
      message: 'Merged cell tidak diizinkan pada area data BoQ.',
    });
  }

  const hiddenRows = worksheet['!rows'] ?? [];
  parsed.rows.forEach((row) => {
    if (hiddenRows[row.sourceRow - 1]?.hidden) {
      row.issues.push({
        code: 'HIDDEN_DATA',
        severity: 'error',
        sourceRow: row.sourceRow,
        message: `Baris Excel ${row.sourceRow} tersembunyi. Tampilkan baris sebelum impor.`,
      });
      row.lineTotal = '0';
    }

    const hasFormula = mappedColumns.some((column) => {
      const address = XLSX.utils.encode_cell({
        r: row.sourceRow - 1,
        c: column,
      });
      return Boolean(worksheet[address]?.f);
    });
    if (hasFormula) {
      row.issues.push({
        code: 'FORMULA_INPUT',
        severity: 'error',
        sourceRow: row.sourceRow,
        message: `Formula terdeteksi pada baris Excel ${row.sourceRow}. Gunakan nilai tetap.`,
      });
      row.lineTotal = '0';
    }
  });

  return recalculatePreview({ ...parsed, issues });
}

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase();
}

function rejectedFile(
  fileName: string,
  fileSize: number,
  requestedSheetName: string | undefined,
  issue: BoqImportIssue,
) {
  const parsed = parseBoqRows([], {
    fileName,
    fileSize,
    sheetName: requestedSheetName ?? '',
    sheetNames: [],
  });
  return { ...parsed, issues: [issue] };
}

export async function parseBoqBytes(
  bytes: Uint8Array,
  fileName: string,
  requestedSheetName?: string,
): Promise<BoqParsedWorkbook> {
  const extension = fileExtension(fileName);
  const baseMetadata = {
    fileName,
    fileSize: bytes.byteLength,
    sheetName: requestedSheetName ?? '',
    sheetNames: [] as string[],
  };

  if (!BOQ_ALLOWED_EXTENSIONS.some((allowed) => allowed === extension)) {
    return rejectedFile(fileName, bytes.byteLength, requestedSheetName, {
      code: 'FILE_TYPE',
      severity: 'error',
      message: 'Gunakan file .xlsx atau .csv. Format .xls/.xlsm tidak diizinkan.',
    });
  }
  if (bytes.byteLength > BOQ_MAX_FILE_SIZE) {
    return rejectedFile(fileName, bytes.byteLength, requestedSheetName, {
      code: 'FILE_SIZE',
      severity: 'error',
      message: 'Ukuran file maksimum 5 MB.',
    });
  }

  const XLSX = await import('xlsx');
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [
      [0x03, 0x04],
      [0x05, 0x06],
      [0x07, 0x08],
    ].some(([third, fourth]) => bytes[2] === third && bytes[3] === fourth);
  const hasNullByte = bytes.some((byte) => byte === 0);
  if (
    (extension === '.xlsx' && !isZip) ||
    (extension === '.csv' && hasNullByte)
  ) {
    return rejectedFile(fileName, bytes.byteLength, requestedSheetName, {
      code: 'FILE_SIGNATURE',
      severity: 'error',
      message: 'Isi file tidak cocok dengan ekstensi yang dipilih.',
    });
  }
  if (extension === '.xlsx' && !safeXlsxEnvelope(bytes)) {
    return rejectedFile(fileName, bytes.byteLength, requestedSheetName, {
      code: 'ZIP_LIMIT',
      severity: 'error',
      message:
        'Struktur Excel tidak valid atau ukuran data setelah dekompresi melampaui batas aman.',
    });
  }
  const workbook = XLSX.read(bytes, {
    type: 'array',
    cellDates: false,
    cellFormula: true,
    cellHTML: false,
    cellStyles: true,
    sheetRows: BOQ_MAX_IMPORT_ROWS + HEADER_SCAN_ROWS + 2,
  });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) {
    const parsed = parseBoqRows([], { ...baseMetadata, sheetNames });
    return {
      ...parsed,
      issues: [
        {
          code: 'EMPTY_WORKBOOK',
          severity: 'error',
          message: 'Workbook tidak memiliki sheet.',
        },
      ],
    };
  }

  const rowsBySheet = new Map<string, unknown[][]>();
  const getRows = (sheetName: string) => {
    const cached = rowsBySheet.get(sheetName);
    if (cached) return cached;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
      range: 0,
    });
    rowsBySheet.set(sheetName, rows);
    return rows;
  };

  let sheetName = requestedSheetName;
  if (!sheetName || !sheetNames.includes(sheetName)) {
    sheetName = [...sheetNames]
      .map((name) => ({
        name,
        score: findHeader(getRows(name))?.score ?? -1,
      }))
      .sort((left, right) => right.score - left.score)[0]?.name;
  }
  sheetName ??= sheetNames[0];

  const parsed = parseBoqRows(getRows(sheetName), {
    fileName,
    fileSize: bytes.byteLength,
    sheetName,
    sheetNames,
  });
  return applyWorksheetGuards(
    parsed,
    workbook.Sheets[sheetName],
    workbook,
    XLSX,
  );
}

export async function parseBoqFile(
  file: File,
  requestedSheetName?: string,
): Promise<BoqParsedWorkbook> {
  if (file.size > BOQ_MAX_FILE_SIZE) {
    return rejectedFile(file.name, file.size, requestedSheetName, {
      code: 'FILE_SIZE',
      severity: 'error',
      message: 'Ukuran file maksimum 5 MB.',
    });
  }
  return parseBoqBytes(
    new Uint8Array(await file.arrayBuffer()),
    file.name,
    requestedSheetName,
  );
}
