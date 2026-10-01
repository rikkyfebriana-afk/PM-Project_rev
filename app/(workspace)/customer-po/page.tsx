import { requireUser } from '@/lib/auth/require-user';
import { getCustomerPoData } from '@/lib/customer-po/queries';
import { CustomerPoWorkspace } from '@/components/modules/customer-po-workspace';
export const metadata = { title: 'PO Customer' };
export default async function CustomerPoPage() {
  const user = await requireUser();
  return <CustomerPoWorkspace data={await getCustomerPoData(user)} />;
}
