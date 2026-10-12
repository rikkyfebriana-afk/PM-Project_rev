import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getDashboardData } from '@/lib/dashboard/queries';
import { requireUser } from '@/lib/auth/require-user';
import {ViewerDashboard} from '@/components/dashboard/viewer-dashboard';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  if(user.role==='VIEWER') return <ViewerDashboard user={user}/>;
  const data = await getDashboardData(user);
  return <DashboardClient data={data} />;
}
