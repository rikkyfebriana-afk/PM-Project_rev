import { requireUser } from '@/lib/auth/require-user';
import { getSettingsData } from '@/lib/settings/queries';
import { SettingsWorkspace } from '@/components/modules/settings-workspace';
import {ViewerPermissionsSettings} from '@/components/modules/viewer-permissions-settings';
export default async function Page({searchParams}:{searchParams:Promise<{viewerId?:string}>}) {
  const user = await requireUser();
  return <><ViewerPermissionsSettings user={user} viewerId={(await searchParams).viewerId}/><SettingsWorkspace data={await getSettingsData(user)} /></>;
}
