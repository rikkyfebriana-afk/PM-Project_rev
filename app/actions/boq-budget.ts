'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
import { prisma } from '@/lib/prisma';

const syncSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  expectedApprovedBoqId: z.string().trim().min(1).max(128),
  expectedProjectUpdatedAt: z.iso.datetime(),
  expectedBudgetValue: z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/),
  confirm: z.literal('yes'),
});

/** An explicit opt-in for an existing approved baseline, never a migration/backfill. */
export async function syncBoqBudgetAction(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) {
    return {
      status: 'error',
      message: 'Sinkronisasi budget hanya untuk Admin atau Project Manager.',
    };
  }
  const parsed = syncSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Periksa konfirmasi dan versi budget. Muat ulang halaman.',
    };
  try {
    const changed = await prisma.$transaction(
      async (tx) => {
        const project = await lockEditableProject(
          tx,
          parsed.data.projectId,
          user,
        );
        if (
          project.updatedAt.toISOString() !==
            parsed.data.expectedProjectUpdatedAt ||
          !project.budgetValue.eq(parsed.data.expectedBudgetValue)
        ) {
          throw new Error(
            'Budget atau project sudah berubah. Muat ulang dan periksa kembali sebelum menyimpan.',
          );
        }
        const approved = await tx.boq.findFirst({
          where: { projectId: project.id, status: 'APPROVED' },
          select: { id: true, version: true },
        });
        if (!approved || approved.id !== parsed.data.expectedApprovedBoqId) {
          throw new Error(
            'Baseline approved sudah berubah. Muat ulang dan periksa kembali.',
          );
        }
        const total = await tx.boqItem.aggregate({
          where: { boqId: approved.id },
          _sum: { lineTotal: true },
        });
        const budgetValue = total._sum.lineTotal ?? new Prisma.Decimal(0);
        if (budgetValue.lt(0) || budgetValue.gt('9999999999999999.99')) {
          throw new Error(
            'Total BoQ melampaui batas penyimpanan budget proyek.',
          );
        }
        if (project.budgetValue.eq(budgetValue)) return false;
        await tx.project.update({
          where: { id: project.id },
          data: { budgetValue },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            projectId: project.id,
            action: 'BOQ_BUDGET_SYNCED',
            entityType: 'Boq',
            entityId: approved.id,
            metadata: {
              projectCode: project.code,
              version: approved.version,
              previousBudgetValue: project.budgetValue.toFixed(2),
              budgetValue: budgetValue.toFixed(2),
            },
          },
        });
        return true;
      },
      { timeout: 20_000 },
    );
    for (const path of [
      '/boq',
      '/finance',
      '/projects',
      '/dashboard',
      '/reports',
    ])
      revalidatePath(path);
    return {
      status: 'success',
      message: changed
        ? 'Budget proyek diperbarui dari total BoQ approved. Biaya aktual tetap mengikuti transaksi biaya.'
        : 'Budget proyek sudah sama dengan total BoQ approved.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Budget belum dapat disinkronkan. Silakan coba lagi.',
    };
  }
}
