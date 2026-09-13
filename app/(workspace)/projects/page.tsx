import { ProjectRegister } from '@/components/projects/project-register';
import { requireUser } from '@/lib/auth/require-user';
import { getProjectRegisterData } from '@/lib/projects/queries';

export const metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const user = await requireUser();
  const data = await getProjectRegisterData(user);
  return <ProjectRegister data={data} />;
}
