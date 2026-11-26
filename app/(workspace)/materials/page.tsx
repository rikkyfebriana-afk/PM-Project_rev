import { randomUUID } from 'node:crypto';
import { updateMaterialAction } from '@/app/actions/materials';
import { MaterialRegister } from '@/components/materials/material-register';
import { MaterialOrderWorkspace } from '@/components/material-orders/material-order-workspace';
import { requireUser } from '@/lib/auth/require-user';
import { hasFullAccess } from '@/lib/auth/roles';
import { getMaterialWorkspaceData } from '@/lib/materials/queries';
import { getMaterialOrderWorkspaceData } from '@/lib/material-orders/queries';

export const metadata = { title: 'Material' };

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireUser();
  const { view } = await searchParams;
  // Viewer permissions cover project materials, never global warehouse stock/orders.
  if (!hasFullAccess(user.role) || view === 'project') {
    const data = await getMaterialWorkspaceData(user);
    return <MaterialRegister data={data} updateAction={updateMaterialAction} />;
  }
  const data = await getMaterialOrderWorkspaceData(user);
  return (
    <MaterialOrderWorkspace
      data={data}
      actorName={user.displayName}
      createRequestId={randomUUID()}
      receiveRequestId={randomUUID()}
    />
  );
}
