import { z } from 'zod';
import { dateOnlyInTimeZone } from '../business-date.ts';
import { moneyInput } from '../finance/validation.ts';
import { operationDate } from '../operations/validation.ts';

const id = z.string().trim().min(1, 'Pilih data yang akan diubah.').max(128);
const date = operationDate.refine(
  (value) => !value.startsWith('0000'),
  'Tahun tanggal tidak valid.',
);
const amount = moneyInput.refine(
  (value) => /[1-9]/.test(value),
  'Nominal harus lebih besar dari nol.',
);
const notes = z.string().trim().max(1000).default('');
const reason = z
  .string()
  .trim()
  .min(5, 'Isi alasan pembatalan minimal 5 karakter.')
  .max(500);
const updatedAt = z.iso.datetime({
  error: 'Versi invoice tidak valid. Muat ulang halaman.',
});

export function invoiceToday(now = new Date()): string {
  return dateOnlyInTimeZone(now, process.env.APP_TIME_ZONE || 'Asia/Jakarta')
    .toISOString()
    .slice(0, 10);
}

export const invoiceSchema = z
  .object({
    invoiceId: z.union([id, z.literal('')]).optional(),
    updatedAt: z.union([updatedAt, z.literal('')]).optional(),
    projectId: id,
    number: z
      .string()
      .transform((value) => value.normalize('NFKC').trim().toUpperCase())
      .pipe(
        z
          .string()
          .min(1, 'Nomor invoice wajib diisi.')
          .max(100, 'Nomor invoice maksimal 100 karakter.'),
      ),
    description: z.string().trim().min(3, 'Isi uraian tagihan.').max(240),
    issueDate: date,
    dueDate: date,
    sentDate: z.union([date, z.literal('')]).default(''),
    amount,
    notes,
  })
  .superRefine((fields, ctx) => {
    if (fields.invoiceId && !fields.updatedAt)
      ctx.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'Versi invoice wajib diisi. Muat ulang halaman.',
      });
    if (fields.dueDate < fields.issueDate)
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Jatuh tempo tidak boleh sebelum tanggal terbit invoice.',
      });
    if (fields.sentDate && fields.sentDate < fields.issueDate)
      ctx.addIssue({
        code: 'custom',
        path: ['sentDate'],
        message: 'Tanggal kirim tidak boleh sebelum tanggal terbit invoice.',
      });
  });

export const invoicePaymentSchema = z.object({
  invoiceId: id,
  requestId: z
    .uuid({ error: 'Referensi permintaan tidak valid. Muat ulang halaman.' })
    .transform((value) => value.toLowerCase()),
  amount,
  paidDate: date,
  reference: z.string().trim().min(1, 'Isi referensi pembayaran.').max(120),
  notes,
});

export const voidInvoicePaymentSchema = z.object({
  invoiceId: id,
  paymentId: id,
  reason,
});

export const voidInvoiceSchema = z.object({ invoiceId: id, updatedAt, reason });
