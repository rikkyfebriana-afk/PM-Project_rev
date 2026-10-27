import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import {defaultViewerScopes,portfolioViewerScopes,type ViewerScope} from '@/lib/viewer-permissions/model';

export function accessibleProjectWhere(
  user: CurrentUser,
  scope: ViewerScope = 'PROJECT',
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

  // Only the four explicitly granted read scopes bypass per-project overrides.
  if(user.viewerPortfolioAccess && portfolioViewerScopes.includes(scope)) return {deletedAt:null};
  return {deletedAt:null,OR:[
    {viewerPermissions:{some:{userId:user.id,scopes:{hasEvery:['PROJECT',scope]}}}},
    ...(scope==='MATERIALS'?[{viewerPermissions:{some:{userId:user.id,scopes:{hasEvery:['PROJECT','OPERATIONS']}}}}]:[]),
    ...(defaultViewerScopes.includes(scope)?[{viewerPermissions:{none:{userId:user.id}}}]:[]),
  ]};
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
