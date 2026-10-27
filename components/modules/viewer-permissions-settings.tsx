import {prisma} from '@/lib/prisma';
import type {CurrentUser} from '@/lib/auth/session';
import {isLocalDemoMode} from '@/lib/auth/session';
import {editableProjectWhere} from '@/lib/projects/access';
import {ViewerPermissionForm,ViewerPortfolioForm,ViewerBulkForm} from './viewer-permissions';
import {permissionSnapshot} from '@/lib/viewer-permissions/snapshot';
import Link from 'next/link';
export async function ViewerPermissionsSettings({user,viewerId}:{user:CurrentUser;viewerId?:string}) {
 if(user.role==='VIEWER'||isLocalDemoMode()) return null;
 const users=await prisma.user.findMany({where:{role:'VIEWER',isActive:true},select:{id:true,displayName:true,username:true,viewerPortfolioAccess:true,viewerAccessVersion:true},orderBy:{displayName:'asc'}});
 const target=users.find(u=>u.id===viewerId)??users[0];
 const projects=target?await prisma.project.findMany({where:editableProjectWhere(user),select:{id:true,code:true,name:true,viewerPermissions:{where:{userId:target.id},select:{version:true,scopes:true}}},orderBy:{code:'asc'}}):[];
 return <section className="m-5 space-y-4 border bg-white p-5">
  <h2 className="text-xl font-semibold">Pengaturan Izin Viewer</h2>
  <p className="text-sm text-slate-600">Pilih akun Viewer terlebih dahulu. Default: seluruh proyek dan PO terlihat; data lainnya tertutup. Viewer tetap hanya baca, tanpa ekspor laporan. PM hanya mengatur proyek yang dikelolanya.</p>
  <nav className="flex flex-wrap gap-2">{users.map(u=><Link className={`border p-2 ${target?.id===u.id?'bg-teal-800 text-white':''}`} key={u.id} href={`/settings?viewerId=${u.id}`}>{u.displayName} ({u.username})</Link>)}</nav>
  {!target&&<p>Belum ada Viewer aktif.</p>}
  {target&&<>
   <p className="font-semibold">Akun terpilih: {target.displayName} ({target.username})</p>
   {user.role==='ADMIN'?<ViewerPortfolioForm key={`${target.id}-${target.viewerAccessVersion}`} userId={target.id} enabled={target.viewerPortfolioAccess} version={target.viewerAccessVersion}/>:<>
    {target.viewerPortfolioAccess&&<p className="rounded bg-teal-50 p-3 text-sm">Admin telah mengaktifkan Proyek, PO, Material dan BoQ untuk semua proyek termasuk proyek baru. Hanya Admin dapat menonaktifkan akses global ini.</p>}
    <ViewerBulkForm key={`${target.id}-${permissionSnapshot(projects)}`} userId={target.id} snapshot={permissionSnapshot(projects)} count={projects.length}/>
   </>}
   <h3 className="font-semibold">Pengaturan tambahan / per proyek</h3>
   <p className="text-sm text-slate-600">Finance memerlukan PO. Dokumen mencakup file komersial. Kosongkan seluruh centang untuk menyembunyikan proyek hanya jika akses semua proyek tidak aktif. Saat akses global aktif, centang di bawah hanya menunjukkan izin per proyek, bukan keseluruhan akses efektif.</p>
  </>}
  {projects.map(p=><details key={`${target?.id}-${p.id}-${p.viewerPermissions[0]?.version??0}`} className="border p-4"><summary className="cursor-pointer font-semibold">{p.code} — {p.name}</summary><div className="mt-4"><ViewerPermissionForm userId={target!.id} projectId={p.id} version={p.viewerPermissions[0]?.version??0} scopes={p.viewerPermissions[0]?.scopes}/></div></details>)}
 </section>;
}
