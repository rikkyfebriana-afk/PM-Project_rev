'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import type { MutationState } from '@/lib/operations/validation';
import { lockEditableProject } from '@/lib/operations/transaction';
import { quotationSchema } from '@/lib/quotations/model';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import type { Prisma } from '@/generated/prisma/client';

const asDate = (v: string) => v ? new Date(`${v}T00:00:00Z`) : null;
async function lockQuote(tx: Prisma.TransactionClient, id: string, version: number) {
  await tx.$queryRaw`SELECT "id" FROM "Quotation" WHERE "id" = ${id} FOR UPDATE`;
  const q = await tx.quotation.findUnique({ where: { id } });
  if (!q || q.version !== version) throw new Error('SPH sudah berubah atau tidak ditemukan. Muat ulang halaman.');
  return q;
}
function failure(e: unknown): MutationState {
  return { status: 'error', message: e instanceof Error && !('code' in e) ? e.message : 'Penyimpanan gagal. Periksa nomor SPH (harus unik) dan muat ulang.' };
}
export async function saveQuotation(_: MutationState, form: FormData): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode()) return { status: 'error', message: 'Hanya Administrator yang dapat mengelola SPH.' };
  const parsed = quotationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: 'error', message: parsed.error.issues.map(i => i.message).join(' ') };
  try {
    const { id, version, ...v } = parsed.data;
    const today = dateOnlyInTimeZone(new Date(), process.env.APP_TIME_ZONE || 'Asia/Jakarta').toISOString().slice(0, 10);
    if (v.sentDate > today) throw new Error('Tanggal pengiriman tidak boleh di masa depan.');
    await prisma.$transaction(async tx => {
      const old = id ? await lockQuote(tx, id, version) : null;
      const linked = id ? await tx.project.count({ where: { quotationId: id } }) : 0;
      const active = id ? await tx.project.count({ where: { quotationId: id, deletedAt: null, customerPoNumber: { not: null }, customerPoStatus: { in: ['RECEIVED', 'IN_PROGRESS', 'COMPLETED'] } } }) : 0;
      if (v.status === 'WON' && !active) throw new Error('Hubungkan minimal satu PO aktif sebelum menandai selesai menjadi PO.');
      if (linked && ['DRAFT', 'REJECTED', 'EXPIRED'].includes(v.status)) throw new Error('Lepaskan hubungan PO terlebih dahulu untuk mengubah ke status ini.');
      if (linked && old?.clientName !== v.clientName) throw new Error('Customer tidak dapat diubah selama ada PO terkait.');
      const data = { ...v, issuedDate: asDate(v.issuedDate)!, sentDate: asDate(v.sentDate), validUntil: asDate(v.validUntil), followUpDate: asDate(v.followUpDate) };
      const saved = id ? await tx.quotation.update({ where: { id }, data: { ...data, version: { increment: 1 } } }) : await tx.quotation.create({ data });
      await tx.auditLog.create({ data: { userId: user.id, entityType: 'Quotation', entityId: saved.id, action: id ? 'QUOTATION_UPDATED' : 'QUOTATION_CREATED', metadata: { before: old ? { number: old.number, status: old.status, value: old.value.toString(), version: old.version } : null, after: v } } });
    });
    revalidatePath('/quotations');
    return { status: 'success', message: 'SPH tersimpan. Pencatatan tanggal kirim tidak mengirim email secara otomatis.' };
  } catch (e) { return failure(e); }
}
export async function linkQuotationPo(_: MutationState, form: FormData): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode()) return { status: 'error', message: 'Hanya Administrator yang dapat mengelola SPH.' };
  const parsed = z.object({ quotationId: z.string().min(1).max(100), version: z.coerce.number().int().min(1), projectId: z.string().min(1).max(100), operation: z.enum(['link', 'unlink']) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: 'error', message: 'Pilih SPH dan PO yang valid.' };
  try {
    await prisma.$transaction(async tx => {
      const v = parsed.data;
      const q = await lockQuote(tx, v.quotationId, v.version);
      const p = await lockEditableProject(tx, v.projectId, user);
      if (v.operation === 'link') {
        if (!['SENT', 'NEGOTIATION'].includes(q.status)) throw new Error('SPH harus Terkirim atau Negosiasi. Buka kembali SPH yang sudah selesai terlebih dahulu.');
        if (p.quotationId) throw new Error('PO ini sudah terhubung ke SPH. Lepaskan hubungan lama sebelum memindahkan.');
        if (!p.customerPoNumber?.trim() || !['RECEIVED', 'IN_PROGRESS', 'COMPLETED'].includes(p.customerPoStatus)) throw new Error('Pilih PO yang sudah diterima, diproses, atau selesai.');
        if (p.clientName?.trim().toLocaleLowerCase('id-ID') !== q.clientName.trim().toLocaleLowerCase('id-ID')) throw new Error('Customer pada SPH dan PO harus sama.');
      } else if (p.quotationId !== q.id) throw new Error('PO tidak terkait dengan SPH ini.');
      await tx.project.update({ where: { id: p.id }, data: { quotationId: v.operation === 'link' ? q.id : null } });
      await tx.quotation.update({ where: { id: q.id }, data: { version: { increment: 1 }, ...(q.status === 'WON' ? { status: 'SENT' } : {}) } });
      await tx.auditLog.create({ data: { userId: user.id, projectId: p.id, entityType: 'Quotation', entityId: q.id, action: v.operation === 'link' ? 'QUOTATION_PO_LINKED' : 'QUOTATION_PO_UNLINKED', metadata: { projectId: p.id, poNumber: p.customerPoNumber, value: p.poValue.toString() } } });
    });
    revalidatePath('/quotations'); revalidatePath('/customer-po');
    return { status: 'success', message: 'Hubungan SPH–PO diperbarui. Nilai PO tidak diubah atau diduplikasi.' };
  } catch (e) { return failure(e); }
}
