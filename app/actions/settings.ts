'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
const password = z
  .string()
  .min(12, 'Password minimal 12 karakter.')
  .refine(
    (v) => Buffer.byteLength(v, 'utf8') <= 72,
    'Password maksimal 72 byte.',
  );
export async function createUser(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== 'ADMIN' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Hanya Admin yang dapat menambah akun.',
    };
  const parsed = z
    .object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .regex(/^[a-zA-Z0-9._-]+$/),
      displayName: z.string().trim().min(2).max(120),
      password,
      role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'VIEWER']),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  const hash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: parsed.data.username,
          normalizedUsername: parsed.data.username.toLowerCase(),
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          passwordHash: hash,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: user.id,
          metadata: { username: user.username, role: user.role },
        },
      });
    });
    revalidatePath('/settings');
    revalidatePath('/projects');
    return {
      status: 'success',
      message:
        'Akun dibuat. Berikan kredensial awal kepada pemilik akun melalui saluran yang sesuai.',
    };
  } catch {
    return {
      status: 'error',
      message: 'Akun belum dapat dibuat. Pastikan username belum digunakan.',
    };
  }
}
export async function setUserActive(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== 'ADMIN' || isLocalDemoMode())
    return { status: 'error', message: 'Akses ditolak.' };
  const parsed = z
    .object({
      id: z.string().min(1).max(128),
      active: z.enum(['true', 'false']),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: 'error', message: 'Permintaan tidak valid.' };
  if (parsed.data.id === actor.id)
    return {
      status: 'error',
      message: 'Akun sendiri tidak dapat dinonaktifkan di sini.',
    };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('pcc-user-administration', 0))`;
      const target = await tx.user.findUnique({
        where: { id: parsed.data.id },
      });
      if (!target) throw new Error('Akun tidak ditemukan.');
      const isActive = parsed.data.active === 'true';
      if (
        !isActive &&
        target.role === 'ADMIN' &&
        (await tx.user.count({ where: { role: 'ADMIN', isActive: true } })) <= 1
      )
        throw new Error('Minimal satu Admin aktif diperlukan.');
      await tx.user.update({
        where: { id: target.id },
        data: { isActive, failedLoginCount: 0, lockedUntil: null },
      });
      if (!isActive)
        await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: target.id,
        },
      });
    });
    revalidatePath('/settings');
    return { status: 'success', message: 'Status akun diperbarui.' };
  } catch {
    return { status: 'error', message: 'Status akun belum dapat diperbarui.' };
  }
}
export async function saveMembership(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== 'ADMIN' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Akses anggota hanya dapat diatur Admin.',
    };
  const parsed = z
    .object({
      projectId: z.string().min(1).max(128),
      userId: z.string().min(1).max(128),
      operation: z.enum(['add', 'remove']),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: 'error', message: 'Pilih project dan anggota.' };
  try {
    await prisma.$transaction(async (tx) => {
      await lockEditableProject(tx, parsed.data.projectId, actor);
      if (
        !(await tx.user.findFirst({
          where: { id: parsed.data.userId, isActive: true },
        }))
      )
        throw new Error('Akun tidak aktif.');
      const { projectId, userId, operation } = parsed.data;
      if (operation === 'add')
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId },
          update: {},
        });
      else await tx.projectMember.deleteMany({ where: { projectId, userId } });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          projectId,
          action: operation === 'add' ? 'MEMBER_ADDED' : 'MEMBER_REMOVED',
          entityType: 'ProjectMember',
          metadata: { memberUserId: userId },
        },
      });
    });
    revalidatePath('/settings');
    revalidatePath('/projects');
    return { status: 'success', message: 'Akses anggota project diperbarui.' };
  } catch {
    return {
      status: 'error',
      message: 'Akses belum dapat diperbarui. Pastikan akun dan project aktif.',
    };
  }
}
export async function changePassword(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const actor = await getCurrentUser();
  if (!actor || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Perubahan password tidak tersedia pada sesi ini.',
    };
  const parsed = z
    .object({
      currentPassword: z.string().min(1).max(200),
      password,
      confirmation: z.string(),
    })
    .refine(
      (v) => v.password === v.confirmation,
      'Konfirmasi password tidak sama.',
    )
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (
    !user ||
    !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))
  )
    return { status: 'error', message: 'Password saat ini tidak sesuai.' };
  const hash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, isActive: true },
        data: { passwordHash: hash },
      });
      if (result.count !== 1) throw new Error('Akun sudah berubah.');
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: user.id,
        },
      });
    });
    return {
      status: 'success',
      message:
        'Password diperbarui. Semua sesi berakhir; silakan login kembali.',
    };
  } catch {
    return { status: 'error', message: 'Password belum dapat diperbarui.' };
  }
}
