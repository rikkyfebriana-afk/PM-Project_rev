'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  createSession,
  destroySession,
  isLocalDemoMode,
} from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export type LoginState = { error?: string };

const loginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(8).max(200),
});

const DUMMY_PASSWORD_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.0RD6DbvA3xvIMhuJU5ALftvVmf0/Ua2';

export async function loginAction(
  _: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Periksa username dan password Anda.' };
  if (isLocalDemoMode() && parsed.data.username.toLowerCase() === 'demo')
    redirect('/dashboard');

  const normalizedUsername = parsed.data.username.toLowerCase();
  const user = await prisma.user.findUnique({ where: { normalizedUsername } });
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const now = new Date();

  if (
    !user ||
    !user.isActive ||
    (user.lockedUntil && user.lockedUntil > now) ||
    !passwordMatches
  ) {
    if (
      user &&
      user.isActive &&
      (!user.lockedUntil || user.lockedUntil <= now)
    ) {
      const failedLoginCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
        },
      });
    }
    return { error: 'Username atau password tidak valid.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
