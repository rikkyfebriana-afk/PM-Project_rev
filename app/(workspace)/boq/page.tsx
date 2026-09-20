import {
  approveBoqRevisionAction,
  commitBoqImportAction,
} from '@/app/actions/boq';
import { BoqImportWorkspace } from '@/components/boq/boq-import-workspace';
import { requireUser } from '@/lib/auth/require-user';
import { getBoqWorkspaceData } from '@/lib/boq/queries';

export const metadata = { title: 'Bill of Quantities' };

export default async function BoqPage() {
  const user = await requireUser();
  const data = await getBoqWorkspaceData(user);
  return (
    <BoqImportWorkspace
      data={data}
      commitAction={commitBoqImportAction}
      approveAction={approveBoqRevisionAction}
    />
  );
}
