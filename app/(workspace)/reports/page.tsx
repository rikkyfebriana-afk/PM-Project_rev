import { requireUser } from '@/lib/auth/require-user';
import { getProjectRegisterData } from '@/lib/projects/queries';
import { ReportsWorkspace } from '@/components/modules/reports-workspace';
export default async function Page() {
  const user = await requireUser();
  return <ReportsWorkspace data={await getProjectRegisterData(user)} />;
}
