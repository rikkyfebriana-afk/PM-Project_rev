import { Prisma } from '../../generated/prisma/client.ts';
import { z } from 'zod';

import { materialStatuses, type MaterialStatusValue } from './types.ts';

const MAX_QUANTITY = new Prisma.Decimal('99999999999999.9999');

type MaterialQuantities = {
  requiredQty: Prisma.Decimal;
  orderedQty: Prisma.Decimal;
  receivedQty: Prisma.Decimal;
  installedQty: Prisma.Decimal;
};

export function materialStatusMatchesQuantities(
  status: MaterialStatusValue,
  quantities: MaterialQuantities,
) {
  const { requiredQty, orderedQty, receivedQty, installedQty } = quantities;
  if (
    receivedQty.gt(requiredQty) ||
    installedQty.gt(receivedQty) ||
    installedQty.gt(requiredQty)
  ) {
    return false;
  }

  switch (status) {
    case 'PLANNED':
      return orderedQty.isZero() && receivedQty.isZero() && installedQty.isZero();
    case 'ORDERED':
      return orderedQty.gt(0) && receivedQty.isZero() && installedQty.isZero();
    case 'PARTIAL':
      return receivedQty.gt(0) && receivedQty.lt(requiredQty);
    case 'RECEIVED':
      return receivedQty.eq(requiredQty) && installedQty.lt(requiredQty);
    case 'INSTALLED':
      return installedQty.eq(requiredQty) && receivedQty.eq(requiredQty);
    case 'SHORTAGE':
      return receivedQty.lt(requiredQty);
  }
}

export function reconcileMaterialStatus(
  previous: MaterialStatusValue,
  quantities: MaterialQuantities,
): MaterialStatusValue {
  const { requiredQty, orderedQty, receivedQty, installedQty } = quantities;
  if (previous === 'SHORTAGE' && receivedQty.lt(requiredQty)) return 'SHORTAGE';
  if (installedQty.eq(requiredQty)) return 'INSTALLED';
  if (receivedQty.eq(requiredQty)) return 'RECEIVED';
  if (receivedQty.gt(0)) return 'PARTIAL';
  if (orderedQty.gt(0)) return 'ORDERED';
  return 'PLANNED';
}

function optionalText(maxLength: number) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform(
      (value) => value?.normalize('NFKC').trim().replace(/\s+/gu, ' ') || null,
    )
    .pipe(z.string().max(maxLength).nullable());
}

function quantity(label: string) {
  return z
    .string()
    .trim()
    .regex(
      /^\d+(?:\.\d{1,4})?$/,
      `${label} harus angka non-negatif, maksimal 4 desimal.`,
    )
    .refine(
      (value) => new Prisma.Decimal(value).lte(MAX_QUANTITY),
      `${label} melampaui batas penyimpanan.`,
    )
    .transform((value) =>
      new Prisma.Decimal(value).toDecimalPlaces(4).toFixed(4),
    );
}

function dateInput(label: string) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || null)
    .refine((value) => {
      if (!value) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(parsed.valueOf()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, `${label} tidak valid.`);
}

export const materialUpdateSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    updatedAt: z.iso.datetime(),
    orderedQty: quantity('Ordered quantity'),
    receivedQty: quantity('Received quantity'),
    installedQty: quantity('Installed quantity'),
    supplier: optionalText(160),
    purchaseOrderNo: optionalText(100),
    needByDate: dateInput('Need-by date'),
    estimatedArrival: dateInput('Estimated arrival'),
    status: z.enum(materialStatuses),
  })
  .superRefine((values, context) => {
    const received = new Prisma.Decimal(values.receivedQty);
    const installed = new Prisma.Decimal(values.installedQty);
    if (installed.gt(received)) {
      context.addIssue({
        code: 'custom',
        path: ['installedQty'],
        message: 'Installed quantity tidak boleh melebihi received quantity.',
      });
    }
  });

export type MaterialUpdateValues = z.infer<typeof materialUpdateSchema>;
