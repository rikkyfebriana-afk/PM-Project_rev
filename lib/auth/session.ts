import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';

import { prisma } from '@/lib/prisma';

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'PROJECT_MANAGER' | 'VIEWER';
};

const DEFAULT_TTL_DAYS = 7;

export function isLocalDemoMode() {
  return (
    process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true'
  );
}

function cookieName() {
  if (process.env.NODE_ENV === 'production')
    return process.env.SESSION_COOKIE_NAME || '__Host-pcc_session';
  return process.env.SESSION_COOKIE_NAME || 'pcc_session';
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function ttlDays() {
  const parsed = Number.parseInt(process.env.SESSION_TTL_DAYS || '', 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, 30)
    : DEFAULT_TTL_DAYS;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays() * 24 * 60 * 60 * 1000);
  const requestHeaders = await headers();
  const forwardedIp = requestHeaders
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const ipSalt = process.env.AUTH_SECRET || 'development-only';

  await prisma.session.create({
    data: {
      tokenHash: digest(token),
      userId,
      expiresAt,
      userAgent: requestHeaders.get('user-agent')?.slice(0, 500),
      ipHash: forwardedIp ? digest(`${ipSalt}:${forwardedIp}`) : null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isLocalDemoMode()) {
    return {
      id: 'demo-user',
      username: 'demo',
      displayName: 'Andi Pratama',
      role: 'ADMIN',
    };
  }

  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session)
      await prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (token && !isLocalDemoMode()) {
    await prisma.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
  cookieStore.delete(cookieName());
}
