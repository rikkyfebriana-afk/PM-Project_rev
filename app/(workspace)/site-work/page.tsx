import { requireUser } from '@/lib/auth/require-user';
import { getOperationsData } from '@/lib/operations/queries';
import { OperationsWorkspace } from '@/components/modules/operations-workspace';

export default async function Page() {
  const user = await requireUser();
  const data = await getOperationsData(user, ['INSTALLATION', 'BAST']);
  return (
    <OperationsWorkspace
      data={data}
      phases={['INSTALLATION', 'BAST']}
      title="Site Work & BAST"
      description="Instalasi, commissioning, dan serah terima pekerjaan dengan dokumen BAST."
    />
  );
}
