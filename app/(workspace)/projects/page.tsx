import { ProjectRegister } from '@/components/projects/project-register';
import {ViewerDashboard} from '@/components/dashboard/viewer-dashboard';
import { requireUser } from '@/lib/auth/require-user';
import { getProjectRegisterData } from '@/lib/projects/queries';

export const metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const user = await requireUser();
  if(user.role==='VIEWER') return <ViewerDashboard user={user}/>;
  const data = await getProjectRegisterData(user);
  return <ProjectRegister data={data} />;
}
