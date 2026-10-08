import { z } from 'zod';

export const quotationStatuses = ['DRAFT', 'SENT', 'NEGOTIATION', 'WON', 'REJECTED', 'EXPIRED'] as const;
export const quotationLabels: Record<string, string> = {
  DRAFT: 'Draft / Belum dikirim', SENT: 'Terkirim', NEGOTIATION: 'Negosiasi',
  PARTIAL: 'Sebagian menjadi PO', WON: 'Selesai menjadi PO', REJECTED: 'Ditolak', EXPIRED: 'Kedaluwarsa',
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Tanggal tidak valid.');
const optionalDate = z.union([date, z.literal('')]);
export const quotationSchema = z.object({
  id: z.string().max(100).default(''),
  version: z.coerce.number().int().min(0),
  number: z.string().trim().min(1).max(100).transform(v => v.toUpperCase()),
  clientName: z.string().trim().min(2).max(160),
  title: z.string().trim().min(3).max(500),
  value: z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/, 'Nilai tanpa pemisah ribuan, maksimal 2 desimal.').refine(v => /[1-9]/.test(v), 'Nilai penawaran harus lebih dari nol.'),
  issuedDate: date, sentDate: optionalDate, validUntil: optionalDate, followUpDate: optionalDate,
  pic: z.string().trim().min(1).max(160),
  status: z.enum(quotationStatuses), notes: z.string().trim().max(4000),
}).superRefine((v, ctx) => {
  if (['SENT', 'NEGOTIATION', 'WON'].includes(v.status) && !v.sentDate)
    ctx.addIssue({ code: 'custom', message: 'Isi tanggal pengiriman SPH.' });
  if (v.status === 'DRAFT' && v.sentDate)
    ctx.addIssue({ code: 'custom', message: 'SPH dengan tanggal kirim tidak dapat berstatus Draft.' });
  for (const field of ['sentDate', 'validUntil', 'followUpDate'] as const)
    if (v[field] && v[field] < v.issuedDate)
      ctx.addIssue({ code: 'custom', message: 'Tanggal kirim, berlaku, atau follow-up tidak boleh sebelum tanggal SPH.' });
});
export type LinkedPo = { id: string; code: string; customerPoNumber: string | null; customerPoStatus: string; poValue: string; deletedAt: string | null };
export function countedPo(p: LinkedPo) {
  return !p.deletedAt && !!p.customerPoNumber?.trim() && ['RECEIVED', 'IN_PROGRESS', 'COMPLETED'].includes(p.customerPoStatus);
}
export function moneyCents(v: string) {
  const [whole, fraction = ''] = v.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function rupiah(cents: bigint) {
  const sign = cents < 0n ? '-' : '';
  const n = cents < 0n ? -cents : cents;
  return `${sign}Rp ${(n / 100n).toLocaleString('id-ID')}${n % 100n ? ',' + String(n % 100n).padStart(2, '0') : ''}`;
}
export function quotationSummary(q: { status: string; value: string; projects: LinkedPo[] }) {
  const active = q.projects.filter(countedPo);
  const total = active.reduce((s, p) => s + moneyCents(p.poValue), 0n);
  const status = active.length ? (q.status === 'WON' ? 'WON' : 'PARTIAL') : (q.status === 'WON' ? 'SENT' : q.status);
  return { count: active.length, total, difference: moneyCents(q.value) - total, status };
}
