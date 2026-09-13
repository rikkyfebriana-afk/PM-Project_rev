'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';

import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { editableProjectWhere } from '@/lib/projects/access';
import type { ProjectActionState } from '@/lib/projects/action-state';
import {
  projectFormSchema,
  type ProjectFormValues,
} from '@/lib/projects/validation';

function valuesFromFormData(formData: FormData) {
  return {
    id: formData.get('id') ?? undefined,
    updatedAt: formData.get('updatedAt') ?? undefined,
    code: formData.get('code'),
    name: formData.get('name'),
    clientName: formData.get('clientName'),
    status: formData.get('status'),
    health: formData.get('health'),
    phase: formData.get('phase'),
    progressPct: formData.get('progressPct'),
    poValue: formData.get('poValue'),
    budgetValue: formData.get('budgetValue'),
    actualCost: formData.get('actualCost'),
    forecastCost: formData.get('forecastCost'),
    address: formData.get('address'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    plannedStart: formData.get('plannedStart'),
    plannedFinish: formData.get('plannedFinish'),
    actualFinish: formData.get('actualFinish'),
    projectManagerId: formData.get('projectManagerId'),
  };
}

function parseProjectForm(formData: FormData) {
  const parsed = projectFormSchema.safeParse(valuesFromFormData(formData));
  if (!parsed.success) {
    return {
      error: {
        status: 'error' as const,
        message: 'Periksa kembali field yang ditandai.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }
  return { data: parsed.data };
}

function dateFromInput(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function fullProjectData(values: ProjectFormValues) {
  return {
    code: values.code,
    name: values.name,
    clientName: values.clientName,
    status: values.status,
    health: values.health,
    phase: values.phase,
    progressPct: new Prisma.Decimal(values.progressPct),
    poValue: new Prisma.Decimal(values.poValue),
    budgetValue: new Prisma.Decimal(values.budgetValue),
    actualCost: new Prisma.Decimal(values.actualCost),
    forecastCost: new Prisma.Decimal(values.forecastCost),
    address: values.address,
    latitude:
      values.latitude === null ? null : new Prisma.Decimal(values.latitude),
    longitude:
      values.longitude === null ? null : new Prisma.Decimal(values.longitude),
    plannedStart: dateFromInput(values.plannedStart),
    plannedFinish: dateFromInput(values.plannedFinish),
    actualFinish: dateFromInput(values.actualFinish),
    projectManagerId: values.projectManagerId,
  };
}

function operationalProjectData(values: ProjectFormValues) {
  return {
    health: values.health,
    phase: values.phase,
    progressPct: new Prisma.Decimal(values.progressPct),
    address: values.address,
    latitude:
      values.latitude === null ? null : new Prisma.Decimal(values.latitude),
    longitude:
      values.longitude === null ? null : new Prisma.Decimal(values.longitude),
    plannedStart: dateFromInput(values.plannedStart),
    plannedFinish: dateFromInput(values.plannedFinish),
    actualFinish: dateFromInput(values.actualFinish),
  };
}

async function validateManager(projectManagerId: string | null) {
  if (!projectManagerId) return true;
  const manager = await prisma.user.findFirst({
    where: {
      id: projectManagerId,
      isActive: true,
      role: { in: ['ADMIN', 'PROJECT_MANAGER'] },
    },
    select: { id: true },
  });
  return Boolean(manager);
}

function mutationError(error: unknown): ProjectActionState {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    return {
      status: 'error',
      message: 'Kode project sudah digunakan. Pilih kode lain.',
      fieldErrors: { code: ['Kode project harus unik.'] },
    };
  }
  return {
    status: 'error',
    message: 'Perubahan belum dapat disimpan. Silakan coba lagi.',
  };
}

function revalidateProjectViews() {
  revalidatePath('/projects');
  revalidatePath('/dashboard');
}

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  if (isLocalDemoMode())
    return {
      status: 'error',
      message:
        'Mode demo hanya baca. Hubungkan PostgreSQL untuk menyimpan data.',
    };
  if (user.role !== 'ADMIN')
    return {
      status: 'error',
      message: 'Hanya Admin yang dapat membuat project.',
    };

  const parsed = parseProjectForm(formData);
  if (!parsed.data) return parsed.error;
  if (!(await validateManager(parsed.data.projectManagerId))) {
    return {
      status: 'error',
      message: 'Project manager tidak aktif atau tidak ditemukan.',
      fieldErrors: { projectManagerId: ['Pilih project manager yang valid.'] },
    };
  }

  try {
    const created = await prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({
        data: fullProjectData(parsed.data),
        select: { id: true, code: true, name: true },
      });
      await transaction.auditLog.create({
        data: {
          userId: user.id,
          projectId: project.id,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: project.id,
          metadata: { code: project.code, name: project.name },
        },
      });
      return project;
    });
    revalidateProjectViews();
    return { status: 'success', message: `${created.code} berhasil dibuat.` };
  } catch (error) {
    return mutationError(error);
  }
}

export async function updateProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  if (isLocalDemoMode())
    return {
      status: 'error',
      message:
        'Mode demo hanya baca. Hubungkan PostgreSQL untuk menyimpan data.',
    };
  if (user.role === 'VIEWER')
    return {
      status: 'error',
      message: 'Akun Viewer tidak dapat mengubah project.',
    };

  const parsed = parseProjectForm(formData);
  if (!parsed.data) return parsed.error;
  const { id, updatedAt } = parsed.data;
  if (!id || !updatedAt) {
    return {
      status: 'error',
      message: 'Identitas versi project tidak lengkap.',
    };
  }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.project.findFirst({
        where: { id, ...editableProjectWhere(user) },
        select: {
          id: true,
          code: true,
          name: true,
          updatedAt: true,
          projectManagerId: true,
        },
      });
      if (!current) return { outcome: 'not-found' as const };
      if (current.updatedAt.toISOString() !== updatedAt)
        return { outcome: 'conflict' as const };

      const managerChanged =
        user.role === 'ADMIN' &&
        parsed.data.projectManagerId !== current.projectManagerId;
      if (managerChanged && parsed.data.projectManagerId) {
        const manager = await transaction.user.findFirst({
          where: {
            id: parsed.data.projectManagerId,
            isActive: true,
            role: { in: ['ADMIN', 'PROJECT_MANAGER'] },
          },
          select: { id: true },
        });
        if (!manager) return { outcome: 'invalid-manager' as const };
      }

      const data =
        user.role === 'ADMIN'
          ? fullProjectData(parsed.data)
          : operationalProjectData(parsed.data);
      const updated = await transaction.project.updateMany({
        where: {
          id: current.id,
          updatedAt: current.updatedAt,
          deletedAt: null,
        },
        data,
      });
      if (updated.count !== 1) return { outcome: 'conflict' as const };

      await transaction.auditLog.create({
        data: {
          userId: user.id,
          projectId: current.id,
          action: 'PROJECT_UPDATED',
          entityType: 'Project',
          entityId: current.id,
          metadata: {
            code: current.code,
            scope: user.role === 'ADMIN' ? 'MASTER' : 'OPERATIONAL',
            changedFields: Object.keys(data),
          },
        },
      });
      if (managerChanged) {
        await transaction.auditLog.create({
          data: {
            userId: user.id,
            projectId: current.id,
            action: 'PROJECT_MANAGER_CHANGED',
            entityType: 'Project',
            entityId: current.id,
            metadata: {
              fromUserId: current.projectManagerId,
              toUserId: parsed.data.projectManagerId,
            },
          },
        });
      }
      return {
        outcome: 'updated' as const,
        project: { id: current.id, code: parsed.data.code },
      };
    });

    if (result.outcome === 'not-found')
      return {
        status: 'error',
        message: 'Project tidak ditemukan atau Anda tidak memiliki akses edit.',
      };
    if (result.outcome === 'conflict')
      return {
        status: 'error',
        message:
          'Project telah diubah pengguna lain. Tutup form, muat ulang, lalu coba lagi.',
      };
    if (result.outcome === 'invalid-manager')
      return {
        status: 'error',
        message: 'Project manager tidak aktif atau tidak ditemukan.',
        fieldErrors: {
          projectManagerId: ['Pilih project manager aktif yang valid.'],
        },
      };

    revalidateProjectViews();
    return {
      status: 'success',
      message: `${result.project.code} berhasil diperbarui.`,
    };
  } catch (error) {
    return mutationError(error);
  }
}

export async function archiveProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  if (isLocalDemoMode())
    return {
      status: 'error',
      message:
        'Mode demo hanya baca. Hubungkan PostgreSQL untuk mengarsipkan data.',
    };
  if (user.role !== 'ADMIN')
    return {
      status: 'error',
      message: 'Hanya Admin yang dapat mengarsipkan project.',
    };

  const id = String(formData.get('id') ?? '');
  const updatedAt = String(formData.get('updatedAt') ?? '');
  if (!id || !updatedAt)
    return { status: 'error', message: 'Identitas project tidak lengkap.' };

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const current = await transaction.project.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, code: true, updatedAt: true },
      });
      if (!current) return 'not-found' as const;
      if (current.updatedAt.toISOString() !== updatedAt)
        return 'conflict' as const;

      const archived = await transaction.project.updateMany({
        where: {
          id: current.id,
          updatedAt: current.updatedAt,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      if (archived.count !== 1) return 'conflict' as const;
      await transaction.auditLog.create({
        data: {
          userId: user.id,
          projectId: current.id,
          action: 'PROJECT_ARCHIVED',
          entityType: 'Project',
          entityId: current.id,
          metadata: { code: current.code },
        },
      });
      return 'archived' as const;
    });

    if (outcome === 'not-found')
      return { status: 'error', message: 'Project tidak ditemukan.' };
    if (outcome === 'conflict')
      return {
        status: 'error',
        message: 'Project telah berubah. Muat ulang sebelum mengarsipkan.',
      };

    revalidateProjectViews();
    return { status: 'success', message: 'Project berhasil diarsipkan.' };
  } catch (error) {
    return mutationError(error);
  }
}
