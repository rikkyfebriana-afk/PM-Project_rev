'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';

import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import type { MaterialActionState } from '@/lib/materials/types';
import {
  materialStatusMatchesQuantities,
  materialUpdateSchema,
} from '@/lib/materials/validation';
import { prisma } from '@/lib/prisma';
import { editableProjectWhere } from '@/lib/projects/access';

function dateFromInput(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function updateMaterialAction(
  _previousState: MaterialActionState,
  formData: FormData,
): Promise<MaterialActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  if (isLocalDemoMode()) {
    return { status: 'error', message: 'Mode demo hanya baca.' };
  }
  if (user.role === 'VIEWER') {
    return {
      status: 'error',
      message: 'Akun Viewer tidak dapat mengubah material.',
    };
  }

  const parsed = materialUpdateSchema.safeParse({
    id: formData.get('id'),
    updatedAt: formData.get('updatedAt'),
    orderedQty: formData.get('orderedQty'),
    receivedQty: formData.get('receivedQty'),
    installedQty: formData.get('installedQty'),
    supplier: formData.get('supplier'),
    purchaseOrderNo: formData.get('purchaseOrderNo'),
    needByDate: formData.get('needByDate'),
    estimatedArrival: formData.get('estimatedArrival'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Periksa kembali field material yang ditandai.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const locator = await transaction.material.findUnique({
        where: { id: parsed.data.id },
        select: { projectId: true },
      });
      if (!locator) return { outcome: 'not-found' as const };

      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${locator.projectId}, 0))
      `;
      const lockedProjects = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Project"
        WHERE "id" = ${locator.projectId}
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (lockedProjects.length !== 1) {
        return { outcome: 'not-found' as const };
      }

      const editableProject = await transaction.project.findFirst({
        where: { id: locator.projectId, ...editableProjectWhere(user) },
        select: { id: true },
      });
      if (!editableProject) return { outcome: 'not-found' as const };

      const current = await transaction.material.findFirst({
        where: {
          id: parsed.data.id,
          projectId: locator.projectId,
          isActive: true,
        },
        select: {
          id: true,
          projectId: true,
          code: true,
          requiredQty: true,
          updatedAt: true,
        },
      });
      if (!current) return { outcome: 'not-found' as const };
      if (current.updatedAt.toISOString() !== parsed.data.updatedAt) {
        return { outcome: 'conflict' as const };
      }

      const received = new Prisma.Decimal(parsed.data.receivedQty);
      const installed = new Prisma.Decimal(parsed.data.installedQty);
      if (
        !materialStatusMatchesQuantities(parsed.data.status, {
          requiredQty: current.requiredQty,
          orderedQty: new Prisma.Decimal(parsed.data.orderedQty),
          receivedQty: received,
          installedQty: installed,
        })
      ) {
        return { outcome: 'status-conflict' as const };
      }

      const updated = await transaction.material.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt, isActive: true },
        data: {
          orderedQty: new Prisma.Decimal(parsed.data.orderedQty),
          receivedQty: received,
          installedQty: installed,
          supplier: parsed.data.supplier,
          purchaseOrderNo: parsed.data.purchaseOrderNo,
          needByDate: dateFromInput(parsed.data.needByDate),
          estimatedArrival: dateFromInput(parsed.data.estimatedArrival),
          status: parsed.data.status,
        },
      });
      if (updated.count !== 1) return { outcome: 'conflict' as const };

      await transaction.auditLog.create({
        data: {
          userId: user.id,
          projectId: current.projectId,
          action: 'MATERIAL_UPDATED',
          entityType: 'Material',
          entityId: current.id,
          metadata: {
            code: current.code,
            orderedQty: parsed.data.orderedQty,
            receivedQty: parsed.data.receivedQty,
            installedQty: parsed.data.installedQty,
            status: parsed.data.status,
          },
        },
      });
      return { outcome: 'updated' as const };
    });

    if (outcome.outcome === 'not-found') {
      return {
        status: 'error',
        message: 'Material tidak ditemukan atau akses ditolak.',
      };
    }
    if (outcome.outcome === 'conflict') {
      return {
        status: 'error',
        message:
          'Material berubah sejak form dibuka. Muat ulang lalu coba lagi.',
      };
    }
    if (outcome.outcome === 'status-conflict') {
      return {
        status: 'error',
        message:
          'Status material tidak sesuai dengan quantity ordered, received, installed, dan kebutuhan.',
      };
    }

    revalidatePath('/materials');
    revalidatePath('/dashboard');
    return {
      status: 'success',
      message: 'Progress material berhasil diperbarui.',
    };
  } catch {
    return {
      status: 'error',
      message: 'Material belum dapat disimpan. Silakan coba lagi.',
    };
  }
}
