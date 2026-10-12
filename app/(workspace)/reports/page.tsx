import { requireUser } from '@/lib/auth/require-user';
import { getProjectRegisterData } from '@/lib/projects/queries';
import { ReportsWorkspace } from '@/components/modules/reports-workspace';
export default async function Page() {
  const user = await requireUser();
  if(user.role==='VIEWER') return <p className="p-6">Ekspor laporan tidak diizinkan untuk Viewer.</p>;
  return <ReportsWorkspace data={await getProjectRegisterData(user)} />;
}
