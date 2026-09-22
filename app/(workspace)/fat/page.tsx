import { requireUser } from '@/lib/auth/require-user';
import { getOperationsData } from '@/lib/operations/queries';
import { OperationsWorkspace } from '@/components/modules/operations-workspace';

export default async function Page() {
  const user = await requireUser();
  const data = await getOperationsData(user, ['FAT']);
  return (
    <OperationsWorkspace
      data={data}
      phases={['FAT']}
      title="FAT"
      description="Pemeriksaan FAT, laporan pengujian, dan penutupan punch list sebelum acceptance."
    />
  );
}
