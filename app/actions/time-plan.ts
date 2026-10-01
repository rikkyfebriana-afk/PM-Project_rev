'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import {
  taskSchema,
  summarizeTasks,
  validatePlan,
} from '@/lib/time-plan/model';
import { serializeTask } from '@/lib/time-plan/serialize';
const identity = z.object({
  projectId: z.string().min(1).max(100),
  updatedAt: z.string().datetime(),
});
function refresh() {
  for (const p of ['/time-plan', '/projects', '/dashboard', '/reports'])
    revalidatePath(p);
}
function failure(e: unknown): MutationState {
  return {
    status: 'error',
    message:
      e instanceof Error && !('code' in e)
        ? e.message
        : 'Time Plan belum dapat disimpan.',
  };
}
function today() {
  return dateOnlyInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || 'Asia/Jakarta',
  )
    .toISOString()
    .slice(0, 10);
}

export async function savePlanTask(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return { status: 'error', message: 'Akses ubah Time Plan ditolak.' };
  const parsed = taskSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  try {
    await prisma.$transaction(async (tx) => {
      const { projectId, updatedAt, id, ...fields } = parsed.data;
      const p = await lockEditableProject(tx, projectId, user);
      if (p.updatedAt.toISOString() !== updatedAt)
        throw new Error(
          'Time Plan atau proyek sudah berubah. Muat ulang halaman.',
        );
      if (p.status === 'CLOSED' || p.status === 'CANCELLED')
        throw new Error('Buka kembali proyek sebelum mengubah Time Plan.');
      const rows = await tx.planTask.findMany({
        where: { projectId, archivedAt: null },
      });
      const old = rows.find((t) => t.id === id);
      if (id && !old)
        throw new Error('Pekerjaan tidak ditemukan pada proyek ini.');
      const taskId = id || randomUUID();
      const candidate = { ...fields, id: taskId };
      const plan = [
        ...rows.filter((t) => t.id !== taskId).map(serializeTask),
        candidate,
      ];
      validatePlan(plan, today());
      const summary = summarizeTasks(plan);
      if (p.timePlanActive && !summary.ready)
        throw new Error(
          'Bobot rencana aktif harus tetap 100%. Minta administrator menonaktifkan acuan progres untuk membagi ulang bobot.',
        );
      const data = {
        ...fields,
        predecessorId: fields.predecessorId || null,
        plannedStart: new Date(`${fields.plannedStart}T00:00:00Z`),
        plannedFinish: new Date(`${fields.plannedFinish}T00:00:00Z`),
        actualStart: fields.actualStart
          ? new Date(`${fields.actualStart}T00:00:00Z`)
          : null,
        actualFinish: fields.actualFinish
          ? new Date(`${fields.actualFinish}T00:00:00Z`)
          : null,
      };
      if (old) await tx.planTask.update({ where: { id: taskId }, data });
      else
        await tx.planTask.create({ data: { ...data, id: taskId, projectId } });
      await tx.project.update({
        where: { id: projectId },
        data: {
          updatedAt: new Date(),
          ...(p.timePlanActive ? { progressPct: summary.progress } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId,
          entityType: 'PlanTask',
          entityId: taskId,
          action: old ? 'PLAN_TASK_UPDATED' : 'PLAN_TASK_CREATED',
          metadata: {
            before: old ? serializeTask(old) : null,
            after: candidate,
            weightedProgress: summary.progress,
            synced: p.timePlanActive,
          },
        },
      });
    });
    refresh();
    return {
      status: 'success',
      message: 'Pekerjaan tersimpan. Bobot dan progres tertimbang diperbarui.',
    };
  } catch (e) {
    return failure(e);
  }
}
export async function archivePlanTask(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return { status: 'error', message: 'Akses ubah Time Plan ditolak.' };
  const parsed = identity
    .extend({ id: z.string().min(1).max(100) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: 'error', message: 'Identitas pekerjaan tidak lengkap.' };
  try {
    await prisma.$transaction(async (tx) => {
      const { projectId, updatedAt, id } = parsed.data;
      const p = await lockEditableProject(tx, projectId, user);
      if (p.updatedAt.toISOString() !== updatedAt)
        throw new Error(
          'Time Plan atau proyek sudah berubah. Muat ulang halaman.',
        );
      if (p.timePlanActive)
        throw new Error(
          'Nonaktifkan acuan progres sebelum mengarsipkan pekerjaan.',
        );
      if (p.status === 'CLOSED' || p.status === 'CANCELLED')
        throw new Error('Buka kembali proyek sebelum mengubah Time Plan.');
      const rows = await tx.planTask.findMany({
        where: { projectId, archivedAt: null },
      });
      const task = rows.find((t) => t.id === id);
      if (!task) throw new Error('Pekerjaan tidak ditemukan.');
      if (rows.some((t) => t.predecessorId === id))
        throw new Error(
          'Pekerjaan masih menjadi pendahulu. Perbarui pekerjaan penerus terlebih dahulu.',
        );
      await tx.planTask.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId,
          entityType: 'PlanTask',
          entityId: id,
          action: 'PLAN_TASK_ARCHIVED',
          metadata: { before: serializeTask(task) },
        },
      });
    });
    refresh();
    return {
      status: 'success',
      message: 'Pekerjaan diarsipkan; riwayat tetap tersimpan.',
    };
  } catch (e) {
    return failure(e);
  }
}
export async function setPlanActive(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode())
    return {
      status: 'error',
      message:
        'Hanya administrator dapat mengaktifkan atau menonaktifkan acuan progres.',
    };
  const parsed = identity
    .extend({ active: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: 'error', message: 'Identitas rencana tidak lengkap.' };
  try {
    await prisma.$transaction(async (tx) => {
      const { projectId, updatedAt, active } = parsed.data;
      const p = await lockEditableProject(tx, projectId, user);
      if (p.updatedAt.toISOString() !== updatedAt)
        throw new Error(
          'Time Plan atau proyek sudah berubah. Muat ulang halaman.',
        );
      const tasks = (
        await tx.planTask.findMany({ where: { projectId, archivedAt: null } })
      ).map(serializeTask);
      const summary = summarizeTasks(tasks);
      if (active === 'true') {
        if (p.status === 'CLOSED' || p.status === 'CANCELLED')
          throw new Error('Buka kembali proyek sebelum mengaktifkan rencana.');
        validatePlan(tasks, today());
        if (!summary.ready)
          throw new Error(
            'Total bobot harus tepat 100% sebelum rencana diaktifkan.',
          );
      }
      await tx.project.update({
        where: { id: projectId },
        data: {
          timePlanActive: active === 'true',
          ...(active === 'true' ? { progressPct: summary.progress } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId,
          entityType: 'TimePlan',
          entityId: projectId,
          action:
            active === 'true' ? 'TIME_PLAN_ACTIVATED' : 'TIME_PLAN_DEACTIVATED',
          metadata: {
            previousProgress: p.progressPct.toString(),
            weightedProgress: summary.progress,
            totalWeight: summary.totalWeight,
          },
        },
      });
    });
    refresh();
    return {
      status: 'success',
      message:
        parsed.data.active === 'true'
          ? 'Time Plan aktif. Dashboard memakai progres tertimbang.'
          : 'Time Plan kembali Draft. Progres proyek terakhir dipertahankan.',
    };
  } catch (e) {
    return failure(e);
  }
}
