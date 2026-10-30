import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth/require-user';
import { hasFullAccess } from '@/lib/auth/roles';
import { getWarehouseWorkspaceData } from '@/lib/warehouse/queries';
import { WarehouseWorkspace } from '@/components/warehouse/warehouse-workspace';

export const metadata = { title: 'Stok Gudang' };

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ returnSearch?: string }> }) {
  const user = await requireUser();
  if (!hasFullAccess(user.role)) return <p className="p-8">Stok gudang hanya dapat diakses Admin atau Project Manager. Akses material proyek mengikuti izin Viewer.</p>;
  const params = await searchParams;
  const data = await getWarehouseWorkspaceData(user, params.returnSearch);
  return <WarehouseWorkspace data={data} requestId={randomUUID()} actorName={user.displayName} receiveRequestId={randomUUID()} issueRequestId={randomUUID()} returnRequestId={randomUUID()} />;
}
