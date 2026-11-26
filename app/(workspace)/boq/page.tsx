import {
  approveBoqRevisionAction,
  commitBoqImportAction,
} from '@/app/actions/boq';
import { BoqImportWorkspace } from '@/components/boq/boq-import-workspace';
import { requireUser } from '@/lib/auth/require-user';
import { getBoqWorkspaceData } from '@/lib/boq/queries';

export const metadata = { title: 'Bill of Quantities' };

export default async function BoqPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; revisionId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await getBoqWorkspaceData(user, {
    projectId:
      typeof params.projectId === 'string' ? params.projectId : undefined,
    revisionId:
      typeof params.revisionId === 'string' ? params.revisionId : undefined,
  });
  return (
    <BoqImportWorkspace
      key={data.costing?.projectId ?? 'no-project'}
      data={data}
      commitAction={commitBoqImportAction}
      approveAction={approveBoqRevisionAction}
    />
  );
}
