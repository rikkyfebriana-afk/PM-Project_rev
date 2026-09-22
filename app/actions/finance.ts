'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
import { costSchema, budgetSchema } from '@/lib/finance/validation';

function refresh() {
  for (const p of ['/finance', 'dashboard', '/projects', '/reports'])
    revalidatePath(p.startsWith('/') ? p : `/${p}`);
}
export async function saveCost(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Akses pencatatan biaya tidak tersedia.',
    };
  const parsed = costSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  try {
    await prisma.$transaction(async (tx) => {
      const p = await lockEditableProject(tx, parsed.data.projectId, user);
      const duplicate = await tx.costEntry.findUnique({
        where: { requestId: parsed.data.requestId },
      });
      if (duplicate) {
        if (duplicate.projectId !== p.id)
          throw new Error('Referensi permintaan tidak valid.');
        return;
      }
      const amount = new Prisma.Decimal(parsed.data.amount);
      if (p.actualCost.plus(amount).gt('9999999999999999.99'))
        throw new Error('Total biaya melampaui batas penyimpanan.');
      const row = await tx.costEntry.create({
        data: {
          ...parsed.data,
          amount,
          spentAt: new Date(`${parsed.data.spentAt}T00:00:00Z`),
        },
      });
      await tx.project.update({
        where: { id: p.id },
        data: { actualCost: p.actualCost.plus(amount) },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: p.id,
          entityType: 'CostEntry',
          entityId: row.id,
          action: 'COST_POSTED',
          metadata: {
            amount: amount.toString(),
            category: row.category,
            referenceNo: row.referenceNo,
          },
        },
      });
    });
    refresh();
    return {
      status: 'success',
      message: 'Biaya dicatat dan actual cost diperbarui.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Biaya belum dapat dicatat.',
    };
  }
}
export async function voidCost(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode())
    return { status: 'error', message: 'Pembatalan biaya hanya untuk Admin.' };
  const parsed = z
    .object({
      id: z.string().min(1).max(128),
      reason: z.string().trim().min(5).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Isi alasan pembatalan minimal 5 karakter.',
    };
  try {
    await prisma.$transaction(async (tx) => {
      const locator = await tx.costEntry.findUnique({
        where: { id: parsed.data.id },
      });
      if (!locator) throw new Error('Biaya tidak ditemukan.');
      const p = await lockEditableProject(tx, locator.projectId, user);
      const current = await tx.costEntry.findUniqueOrThrow({
        where: { id: locator.id },
      });
      if (current.voidedAt) throw new Error('Biaya sudah dibatalkan.');
      await tx.costEntry.update({
        where: { id: current.id },
        data: { voidedAt: new Date(), voidReason: parsed.data.reason },
      });
      const sum = await tx.costEntry.aggregate({
        where: { projectId: p.id, voidedAt: null },
        _sum: { amount: true },
      });
      await tx.project.update({
        where: { id: p.id },
        data: { actualCost: p.costOpeningBalance.plus(sum._sum.amount ?? 0) },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: p.id,
          action: 'COST_VOIDED',
          entityType: 'CostEntry',
          entityId: current.id,
          metadata: {
            reason: parsed.data.reason,
            amount: current.amount.toString(),
          },
        },
      });
    });
    refresh();
    return {
      status: 'success',
      message: 'Biaya dibatalkan; jejak transaksi tetap tersimpan.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Pembatalan gagal.',
    };
  }
}
export async function saveBudget(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Perubahan baseline finance hanya untuk Admin.',
    };
  const parsed = budgetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Periksa nilai dan versi baseline finance.',
    };
  try {
    await prisma.$transaction(async (tx) => {
      const p = await lockEditableProject(tx, parsed.data.projectId, user);
      if (p.updatedAt.toISOString() !== parsed.data.updatedAt)
        throw new Error('Project sudah berubah. Muat ulang halaman.');
      const { poValue, budgetValue, forecastCost } = parsed.data;
      await tx.project.update({
        where: { id: p.id },
        data: { poValue, budgetValue, forecastCost },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: p.id,
          action: 'FINANCE_BASELINE_UPDATED',
          entityType: 'Project',
          entityId: p.id,
          metadata: {
            before: {
              poValue: p.poValue.toString(),
              budgetValue: p.budgetValue.toString(),
              forecastCost: p.forecastCost.toString(),
            },
            after: { poValue, budgetValue, forecastCost },
          },
        },
      });
    });
    refresh();
    return { status: 'success', message: 'Baseline finance diperbarui.' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Baseline belum dapat disimpan.',
    };
  }
}
