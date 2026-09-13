import type { ReactNode } from 'react';

import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
