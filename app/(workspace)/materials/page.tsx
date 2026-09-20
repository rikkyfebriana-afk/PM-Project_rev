import { updateMaterialAction } from '@/app/actions/materials';
import { MaterialRegister } from '@/components/materials/material-register';
import { requireUser } from '@/lib/auth/require-user';
import { getMaterialWorkspaceData } from '@/lib/materials/queries';

export const metadata = { title: 'Material Register' };

export default async function MaterialsPage() {
  const user = await requireUser();
  const data = await getMaterialWorkspaceData(user);
  return <MaterialRegister data={data} updateAction={updateMaterialAction} />;
}
