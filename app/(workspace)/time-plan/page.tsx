import { requireUser } from '@/lib/auth/require-user';
import { getTimePlanData } from '@/lib/time-plan/queries';
import { TimePlanWorkspace } from '@/components/modules/time-plan-workspace';
export const metadata = { title: 'Time Plan' };
export default async function TimePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  return (
    <TimePlanWorkspace
      data={await getTimePlanData(await requireUser())}
      initialProjectId={projectId}
    />
  );
}
