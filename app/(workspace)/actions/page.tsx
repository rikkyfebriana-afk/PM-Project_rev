import { requireUser } from '@/lib/auth/require-user';
import { getOperationsData } from '@/lib/operations/queries';
import { ActionsWorkspace } from '@/components/modules/operations-workspace';
export default async function Page() {
  const user = await requireUser();
  return <ActionsWorkspace data={await getOperationsData(user, [])} />;
}
