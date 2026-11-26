import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.ts';
import {
  normalizeWarehouseToken,
  warehouseMaxQuantity,
} from '../warehouse/validation.ts';

const id = z.string().trim().min(1).max(128);
const text = (max: number) => z.string().trim().max(max).default('');
const quantity = z
  .string()
  .trim()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    'Jumlah harus angka positif, maksimal empat desimal.',
  )
  .refine((value) => {
    if (!/^\d{1,14}(?:\.\d{1,4})?$/.test(value)) return false;
    const amount = new Prisma.Decimal(value);
    return amount.gt(0) && amount.lte(warehouseMaxQuantity);
  }, 'Jumlah tidak valid atau melebihi batas.')
  .transform((value) => new Prisma.Decimal(value).toFixed(4));
const expectedArrival = text(10)
  .refine((value) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Tanggal perkiraan kedatangan tidak valid.')
  .transform((value) => value || null);

const draftFields = {
  quantity,
  supplier: text(200),
  referenceNo: text(100),
  expectedArrival,
  notes: text(1000),
};
export const materialOrderCreateSchema = z.object({
  ...draftFields,
  requestId: z.string().uuid(),
  warehouseItemId: id,
});
export const materialOrderVersionSchema = z.object({
  id,
  updatedAt: z.iso.datetime(),
});
export const materialOrderUpdateSchema =
  materialOrderVersionSchema.extend(draftFields);
export const materialOrderCancelSchema = materialOrderVersionSchema.extend({
  reason: z.string().trim().min(2, 'Isi alasan pembatalan.').max(1000),
});
export const materialOrderReceiptSchema = z.object({
  requestId: z.string().uuid(),
  orderId: id,
  expectedUnit: z
    .string()
    .transform(normalizeWarehouseToken)
    .pipe(z.string().min(1).max(32)),
  quantity,
  referenceNo: z.string().trim().min(1, 'Isi nomor bukti penerimaan.').max(100),
  recipient: z.string().trim().min(1, 'Isi nama penerima.').max(120),
  notes: text(1000),
});

export class MaterialOrderError extends Error {}
