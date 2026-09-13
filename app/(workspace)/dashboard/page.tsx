import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getDashboardData } from '@/lib/dashboard/queries';
import { requireUser } from '@/lib/auth/require-user';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  return <DashboardClient data={data} />;
}
