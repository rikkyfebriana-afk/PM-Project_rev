import Link from 'next/link';
import { updateMaterialAction } from '@/app/actions/materials';
import { MaterialRegister } from '@/components/materials/material-register';
import { requireUser } from '@/lib/auth/require-user';
import { hasFullAccess } from '@/lib/auth/roles';
import { getMaterialWorkspaceData } from '@/lib/materials/queries';

export const metadata = { title: 'Material Proyek · BoQ' };

export default async function ProjectMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await getMaterialWorkspaceData(user);
  const initialProjectId =
    typeof params.projectId === 'string' &&
    data.materials.some((material) => material.projectId === params.projectId)
      ? params.projectId
      : 'ALL';
  return (
    <>
      <nav
        aria-label="Alur material proyek"
        className="mx-auto flex max-w-[1600px] flex-wrap gap-3 px-4 pt-6 text-sm md:px-7 xl:px-9"
      >
        <Link
          href="/boq"
          className="rounded border border-slate-300 bg-white px-4 py-2 font-semibold text-[#17364a] hover:bg-slate-50"
        >
          ← BoQ & anggaran proyek
        </Link>
        {hasFullAccess(user.role) && (
          <Link
            href="/materials"
            className="rounded border border-slate-300 bg-white px-4 py-2 font-semibold text-[#17364a] hover:bg-slate-50"
          >
            Material Status Order
          </Link>
        )}
      </nav>
      <MaterialRegister
        key={initialProjectId}
        data={data}
        initialProjectId={initialProjectId}
        updateAction={updateMaterialAction}
      />
    </>
  );
}
