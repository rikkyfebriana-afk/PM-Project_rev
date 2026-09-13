import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';

export function accessibleProjectWhere(
  user: CurrentUser,
): Prisma.ProjectWhereInput {
  if (user.role === 'ADMIN') return { deletedAt: null };

  if (user.role === 'PROJECT_MANAGER') {
    return {
      deletedAt: null,
      OR: [
        { projectManagerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };
  }

  return {
    deletedAt: null,
    members: { some: { userId: user.id } },
  };
}

export function editableProjectWhere(
  user: CurrentUser,
): Prisma.ProjectWhereInput {
  if (user.role === 'ADMIN') return { deletedAt: null };
  if (user.role !== 'PROJECT_MANAGER') return { id: '__no_project__' };

  return {
    deletedAt: null,
    projectManagerId: user.id,
  };
}
