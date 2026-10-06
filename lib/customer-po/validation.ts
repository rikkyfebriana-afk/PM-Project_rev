import { z } from 'zod';

export const poStatuses = [
  'DRAFT',
  'RECEIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export const poStatusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  RECEIVED: 'Diterima',
  IN_PROGRESS: 'Diproses',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Tanggal kalender tidak valid.');
const money = z
  .string()
  .trim()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    'Nilai rupiah harus positif, maksimal 2 desimal, tanpa pemisah ribuan.',
  );
export const customerPoSchema = z
  .object({
    projectId: z.string().min(1).max(100),
    updatedAt: z.string().datetime(),
    customerPoNumber: z
      .string()
      .trim()
      .min(1, 'Nomor PO wajib diisi.')
      .max(100),
    clientName: z.string().trim().min(2, 'Nama customer wajib diisi.').max(160),
    customerPoDate: date,
    customerPoCompletedDate: z.union([date, z.literal('')]).default(''),
    customerPoDescription: z.string().trim().min(3).max(2000),
    poValue: money,
    customerPoTax: money,
    customerPoDelivery: z.union([date, z.literal('')]),
    customerPoStatus: z.enum(poStatuses),
    customerPoNotes: z.string().trim().max(4000),
  })
  .superRefine((v, ctx) => {
    if (v.customerPoStatus === 'COMPLETED' && !v.customerPoCompletedDate)
      ctx.addIssue({
        code: 'custom',
        path: ['customerPoCompletedDate'],
        message: 'Isi tanggal selesai PO untuk status Selesai.',
      });
    if (
      v.customerPoCompletedDate &&
      (v.customerPoStatus !== 'COMPLETED' ||
        v.customerPoCompletedDate < v.customerPoDate)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['customerPoCompletedDate'],
        message:
          'Tanggal selesai hanya untuk PO Selesai dan tidak boleh sebelum tanggal PO.',
      });
    if (v.customerPoDelivery && v.customerPoDelivery < v.customerPoDate)
      ctx.addIssue({
        code: 'custom',
        path: ['customerPoDelivery'],
        message: 'Target delivery tidak boleh sebelum tanggal PO.',
      });
  });
