import { requireUser } from '@/lib/auth/require-user';
import { getOperationsData } from '@/lib/operations/queries';
import { OperationsWorkspace } from '@/components/modules/operations-workspace';

export default async function Page() {
  const user = await requireUser();
  const data = await getOperationsData(user, ['PRODUCTION']);
  return (
    <OperationsWorkspace
      data={data}
      phases={['PRODUCTION']}
      title="Production"
      description="Paket fabrikasi dan assembly, progress fisik, target selesai, serta foto pendukung."
    />
  );
}
