import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import {hasFullAccess} from '@/lib/auth/roles';
import {defaultViewerScopes,portfolioViewerScopes,type ViewerScope} from '@/lib/viewer-permissions/model';

export function accessibleProjectWhere(
  user: CurrentUser,
  scope: ViewerScope = 'PROJECT',
): Prisma.ProjectWhereInput {
  if (hasFullAccess(user.role)) return { deletedAt: null };

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
  if (hasFullAccess(user.role)) return { deletedAt: null };
  return { id: '__no_project__' };
}
