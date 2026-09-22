'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  operationSchema,
  actionSchema,
  type MutationState,
} from '@/lib/operations/validation';
import { lockEditableProject } from '@/lib/operations/transaction';

function refresh() {
  for (const path of [
    '/production',
    '/fat',
    '/delivery',
    '/site-work',
    '/actions',
    '/dashboard',
    '/reports',
  ])
    revalidatePath(path);
}
export async function saveOperation(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Akses simpan tidak tersedia untuk sesi ini.',
    };
  const parsed = operationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  const { id, updatedAt, ...v } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      await lockEditableProject(tx, v.projectId, user);
      const current = id
        ? await tx.milestone.findFirst({
            where: { id, projectId: v.projectId },
          })
        : null;
      if (id && (!current || current.updatedAt.toISOString() !== updatedAt))
        throw new Error('Data sudah berubah. Muat ulang sebelum menyimpan.');
      if (current && current.phase !== v.phase)
        throw new Error(
          'Fase record tidak dapat diganti. Buat record baru pada fase yang sesuai.',
        );
      if (v.status === 'COMPLETED') {
        const open = id
          ? await tx.actionItem.count({
              where: { milestoneId: id, status: { not: 'RESOLVED' } },
            })
          : 0;
        if (open)
          throw new Error(
            'Selesaikan seluruh punch list terkait sebelum menutup milestone.',
          );
        const category =
          v.phase === 'FAT'
            ? 'FAT'
            : v.phase === 'DELIVERY'
              ? 'DELIVERY_ORDER'
              : v.phase === 'BAST'
                ? 'BAST'
                : null;
        if (category) {
          const proof = id
            ? await tx.document.count({
                where: {
                  milestoneId: id,
                  projectId: v.projectId,
                  category,
                  status: 'READY',
                  deletedAt: null,
                },
              })
            : 0;
          if (!proof || !v.referenceNo)
            throw new Error(
              'Simpan draft terlebih dahulu, unggah dokumen pendukung, dan isi nomor referensi sebelum menandai selesai.',
            );
        }
        if (v.phase === 'BAST') {
          const pending = await tx.milestone.count({
            where: {
              projectId: v.projectId,
              phase: 'INSTALLATION',
              status: { not: 'COMPLETED' },
            },
          });
          if (pending)
            throw new Error(
              'Masih ada pekerjaan instalasi yang belum selesai.',
            );
        }
      }
      const data = {
        ...v,
        plannedDate: new Date(`${v.plannedDate}T00:00:00Z`),
        progressPct: v.progressPct,
        completedAt:
          v.status === 'COMPLETED'
            ? (current?.completedAt ?? new Date())
            : null,
      };
      const row = id
        ? await tx.milestone.update({ where: { id }, data })
        : await tx.milestone.create({ data });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: v.projectId,
          entityType: 'Milestone',
          entityId: row.id,
          action: id ? 'OPERATION_UPDATED' : 'OPERATION_CREATED',
          metadata: {
            phase: v.phase,
            status: v.status,
            progressPct: v.progressPct,
            previousStatus: current?.status ?? null,
          },
        },
      });
    });
    refresh();
    return { status: 'success', message: 'Milestone operasional tersimpan.' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Data belum dapat disimpan.',
    };
  }
}

export async function saveActionItem(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Akses simpan tidak tersedia untuk sesi ini.',
    };
  const parsed = actionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  const { id, updatedAt, ...v } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      await lockEditableProject(tx, v.projectId, user);
      const current = id
        ? await tx.actionItem.findFirst({
            where: { id, projectId: v.projectId },
          })
        : null;
      if (id && (!current || current.updatedAt.toISOString() !== updatedAt))
        throw new Error('Action sudah berubah. Muat ulang halaman.');
      if (current && current.milestoneId !== v.milestoneId)
        throw new Error('Tautan milestone tidak dapat diubah.');
      if (v.milestoneId) {
        const milestone = await tx.milestone.findFirst({
          where: { id: v.milestoneId, projectId: v.projectId },
        });
        if (!milestone) throw new Error('Milestone tidak ditemukan.');
        if (milestone.status === 'COMPLETED' && v.status !== 'RESOLVED')
          throw new Error(
            'Buka kembali milestone sebelum menambah atau membuka punch list.',
          );
      }
      const data = {
        ...v,
        dueAt: v.dueAt ? new Date(`${v.dueAt}T00:00:00Z`) : null,
        resolvedAt:
          v.status === 'RESOLVED' ? (current?.resolvedAt ?? new Date()) : null,
      };
      const row = id
        ? await tx.actionItem.update({ where: { id }, data })
        : await tx.actionItem.create({ data });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: v.projectId,
          entityType: 'ActionItem',
          entityId: row.id,
          action: id ? 'ACTION_UPDATED' : 'ACTION_CREATED',
          metadata: {
            status: v.status,
            priority: v.priority,
            milestoneId: v.milestoneId,
          },
        },
      });
    });
    refresh();
    return { status: 'success', message: 'Action item tersimpan.' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'Action belum dapat disimpan.',
    };
  }
}
