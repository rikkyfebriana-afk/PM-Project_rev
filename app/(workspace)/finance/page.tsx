import { requireUser } from '@/lib/auth/require-user';
import { getFinanceData } from '@/lib/finance/queries';
import { FinanceWorkspace } from '@/components/modules/finance-workspace';
export default async function Page() {
  const user = await requireUser();
  return <FinanceWorkspace data={await getFinanceData(user)} />;
}
