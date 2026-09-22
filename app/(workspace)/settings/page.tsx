import { requireUser } from '@/lib/auth/require-user';
import { getSettingsData } from '@/lib/settings/queries';
import { SettingsWorkspace } from '@/components/modules/settings-workspace';
export default async function Page() {
  const user = await requireUser();
  return <SettingsWorkspace data={await getSettingsData(user)} />;
}
