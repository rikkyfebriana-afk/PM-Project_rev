import { createHash } from 'node:crypto';

import { Prisma } from '../../generated/prisma/client.ts';
import { z } from 'zod';

import {
  boqItemTypes,
  MAX_BOQ_IMPORT_ROWS,
  type BoqImportField,
  type BoqImportIssue,
} from './types.ts';

const MAX_REPORTED_ISSUES = 100;
const MAX_QUANTITY = new Prisma.Decimal('99999999999999.9999');
const MAX_MONEY = new Prisma.Decimal('9999999999999999.99');

function normalizeText(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function normalizedText(label: string, maxLength: number) {
  return z
    .string({ error: `${label} wajib berupa teks.` })
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1, `${label} wajib diisi.`)
        .max(maxLength, `${label} maksimal ${maxLength} karakter.`),
    );
}

function decimalText(options: {
  label: string;
  scale: number;
  maximum: Prisma.Decimal;
  strictlyPositive?: boolean;
}) {
  return z
    .string({ error: `${options.label} wajib berupa teks angka.` })
    .trim()
    .max(64, `${options.label} terlalu panjang.`)
    .refine(
      (value) =>
        new RegExp(`^\\d+(?:\\.\\d{1,${options.scale}})?$`).test(value),
      `${options.label} harus angka non-negatif dengan maksimal ${options.scale} desimal. Gunakan titik sebagai pemisah desimal.`,
    )
    .refine((value) => {
      if (!/^\d+(?:\.\d+)?$/.test(value)) return true;
      const decimal = new Prisma.Decimal(value);
      return options.strictlyPositive ? decimal.gt(0) : decimal.gte(0);
    }, `${options.label} harus lebih besar dari 0.`)
    .refine((value) => {
      if (!/^\d+(?:\.\d+)?$/.test(value)) return true;
      return new Prisma.Decimal(value).lte(options.maximum);
    }, `${options.label} melampaui batas penyimpanan.`);
}

const nullableItemCodeSchema = z
  .union([z.string(), z.null()])
  .transform((value) => (value === null ? null : normalizeText(value)))
  .pipe(
    z.union([z.null(), z.string().max(80, 'Kode item maksimal 80 karakter.')]),
  )
  .transform((value) => (value === '' ? null : value));

const itemCodeSchema = nullableItemCodeSchema.transform((value) =>
  value === null ? null : value.toLocaleUpperCase('en-US'),
);

const importRowSchema = z
  .object({
    itemNo: normalizedText('Nomor item', 40),
    itemCode: itemCodeSchema,
    itemType: z
      .string({ error: 'Tipe item wajib berupa teks.' })
      .transform((value) => normalizeText(value).toLocaleUpperCase('en-US'))
      .pipe(z.enum(boqItemTypes, { error: 'Tipe item tidak valid.' })),
    description: normalizedText('Deskripsi', 500),
    unit: normalizedText('Satuan', 32).transform((value) =>
      value.toLocaleUpperCase('en-US'),
    ),
    quantity: decimalText({
      label: 'Kuantitas',
      scale: 4,
      maximum: MAX_QUANTITY,
      strictlyPositive: true,
    }),
    unitPrice: decimalText({
      label: 'Harga satuan',
      scale: 2,
      maximum: MAX_MONEY,
    }),
  })
  .superRefine((row, context) => {
    if (row.itemType === 'MATERIAL' && row.itemCode === null) {
      context.addIssue({
        code: 'custom',
        path: ['itemCode'],
        message: 'Kode item wajib untuk tipe MATERIAL.',
      });
    }
  });

const importPayloadSchema = z.object({
  projectId: normalizedText('Project', 128),
  fileName: normalizedText('Nama file', 255).transform((value) => {
    const parts = value.split(/[\\/]/u);
    return parts.at(-1) ?? value;
  }),
  sheetName: normalizedText('Nama sheet', 100),
  rows: z
    .array(importRowSchema, { error: 'Baris BoQ tidak valid.' })
    .min(1, 'Tidak ada baris BoQ yang dapat diimpor.')
    .max(
      MAX_BOQ_IMPORT_ROWS,
      `Maksimal ${MAX_BOQ_IMPORT_ROWS.toLocaleString('id-ID')} baris per impor.`,
    ),
});

export type ValidatedBoqImportRow = z.infer<typeof importRowSchema> & {
  lineTotal: string;
};

export type ValidatedBoqImport = {
  projectId: string;
  fileName: string;
  sheetName: string;
  rows: ValidatedBoqImportRow[];
  sourceHash: string;
  totalValue: string;
};

export type BoqImportValidationResult =
  | { success: true; data: ValidatedBoqImport }
  | { success: false; issues: BoqImportIssue[] };

function fieldFromPath(path: PropertyKey[]): BoqImportField {
  const candidate = path[0] === 'rows' ? path[2] : path[0];
  if (
    candidate === 'projectId' ||
    candidate === 'fileName' ||
    candidate === 'sheetName' ||
    candidate === 'itemNo' ||
    candidate === 'itemCode' ||
    candidate === 'itemType' ||
    candidate === 'description' ||
    candidate === 'unit' ||
    candidate === 'quantity' ||
    candidate === 'unitPrice'
  ) {
    return candidate;
  }
  return 'rows';
}

function zodIssues(error: z.ZodError): BoqImportIssue[] {
  return error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
    row:
      issue.path[0] === 'rows' && typeof issue.path[1] === 'number'
        ? issue.path[1] + 1
        : undefined,
    field: fieldFromPath(issue.path),
    message: issue.message,
  }));
}

function canonicalHash(rows: ValidatedBoqImportRow[]) {
  const canonicalRows = rows.map(
    ({
      itemNo,
      itemCode,
      itemType,
      description,
      unit,
      quantity,
      unitPrice,
    }) => ({
      itemNo,
      itemCode,
      itemType,
      description,
      unit,
      quantity,
      unitPrice,
    }),
  );
  return createHash('sha256')
    .update(`boq-import:v1\n${JSON.stringify(canonicalRows)}`)
    .digest('hex');
}

export function validateBoqImportPayload(
  input: unknown,
): BoqImportValidationResult {
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, issues: zodIssues(parsed.error) };
  }

  const issues: BoqImportIssue[] = [];
  const seenItemNumbers = new Map<string, number>();
  const seenMaterialCodes = new Map<string, number>();
  let totalValue = new Prisma.Decimal(0);

  const rows = parsed.data.rows.map((row, index): ValidatedBoqImportRow => {
    const canonicalItemNo = row.itemNo.toLocaleLowerCase('en-US');
    const previousRow = seenItemNumbers.get(canonicalItemNo);
    if (previousRow !== undefined) {
      issues.push({
        row: index + 1,
        field: 'itemNo',
        message: `Nomor item duplikat dengan baris ${previousRow}.`,
      });
    } else {
      seenItemNumbers.set(canonicalItemNo, index + 1);
    }

    if (row.itemType === 'MATERIAL' && row.itemCode) {
      const previousMaterialRow = seenMaterialCodes.get(row.itemCode);
      if (previousMaterialRow !== undefined) {
        issues.push({
          row: index + 1,
          field: 'itemCode',
          message: `Kode material duplikat dengan baris ${previousMaterialRow}.`,
        });
      } else {
        seenMaterialCodes.set(row.itemCode, index + 1);
      }
    }

    const quantity = new Prisma.Decimal(row.quantity).toDecimalPlaces(4);
    const unitPrice = new Prisma.Decimal(row.unitPrice).toDecimalPlaces(2);
    const lineTotal = quantity
      .mul(unitPrice)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    if (lineTotal.gt(MAX_MONEY)) {
      issues.push({
        row: index + 1,
        field: 'unitPrice',
        message: 'Total baris melampaui batas penyimpanan.',
      });
    }

    totalValue = totalValue.plus(lineTotal);
    return {
      ...row,
      quantity: quantity.toFixed(4),
      unitPrice: unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
    };
  });

  if (issues.length > 0) {
    return { success: false, issues: issues.slice(0, MAX_REPORTED_ISSUES) };
  }

  return {
    success: true,
    data: {
      projectId: parsed.data.projectId,
      fileName: parsed.data.fileName,
      sheetName: parsed.data.sheetName,
      rows,
      sourceHash: canonicalHash(rows),
      totalValue: totalValue.toFixed(2),
    },
  };
}
