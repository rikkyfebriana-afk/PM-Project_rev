import { requireUser } from '@/lib/auth/require-user';
import { getOperationsData } from '@/lib/operations/queries';
import { OperationsWorkspace } from '@/components/modules/operations-workspace';

export default async function Page() {
  const user = await requireUser();
  const data = await getOperationsData(user, ['DELIVERY']);
  return (
    <OperationsWorkspace
      data={data}
      phases={['DELIVERY']}
      title="Delivery"
      description="Jadwal pengiriman, penanggung jawab, nomor Delivery Order, dan bukti penerimaan."
    />
  );
}
