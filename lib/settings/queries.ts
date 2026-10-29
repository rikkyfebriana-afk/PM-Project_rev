import 'server-only';
import { hasFullAccess } from '@/lib/auth/roles';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
export async function getSettingsData(user: CurrentUser) {
  const demoMode = isLocalDemoMode();
  const users =
    demoMode || !hasFullAccess(user.role)
      ? []
      : await prisma.user.findMany({
          orderBy: { displayName: 'asc' },
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            isActive: true,
          },
        });
  const projects =
    demoMode || !hasFullAccess(user.role)
      ? []
      : await prisma.project.findMany({
          where: { deletedAt: null },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            members: {
              select: { userId: true, user: { select: { displayName: true } } },
            },
          },
        });
  const logs =
    demoMode || !hasFullAccess(user.role)
      ? []
      : await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true,
            user: { select: { displayName: true } },
            project: { select: { code: true } },
          },
        });
  return {
    demoMode,
    isAdmin: hasFullAccess(user.role),
    currentUserId: user.id,
    users,
    projects,
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}
export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;
