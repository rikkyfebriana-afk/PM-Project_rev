'use client';
import {useActionState} from 'react';
import {saveViewerPermission,saveViewerPortfolioAccess,grantViewerCurrentProjects} from '@/app/actions/viewer-permissions';
import {viewerScopes,viewerScopeLabels,defaultViewerScopes} from '@/lib/viewer-permissions/model';
import {idleState} from '@/lib/operations/validation';
import {buttonClass,MutationFeedback} from './workspace-ui';
export function ViewerPermissionForm({userId,projectId,scopes,version}:{userId:string;projectId:string;scopes?:string[];version:number}) {
 const [state,action,pending]=useActionState(saveViewerPermission,idleState);
 return <form action={action} className="space-y-3"><input type="hidden" name="userId" value={userId}/><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="version" value={version}/><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">{viewerScopes.map(scope=><label key={scope} className="flex items-start gap-2 text-sm"><input type="checkbox" name="scopes" value={scope} defaultChecked={(scopes??defaultViewerScopes).includes(scope)}/>{viewerScopeLabels[scope]}</label>)}<button className={buttonClass}>Simpan izin Viewer</button></fieldset><MutationFeedback state={state}/></form>;
}

export function ViewerPortfolioForm({userId,enabled,version}:{userId:string;enabled:boolean;version:number}) {
 const [state,action,pending]=useActionState(saveViewerPortfolioAccess,idleState);
 return <form action={action} className="space-y-3 rounded border border-teal-200 bg-teal-50 p-4">
  <h3 className="font-semibold">Akses semua proyek sekaligus</h3>
  <p className="text-sm">Status: <strong>{enabled?'Aktif':'Belum aktif'}</strong>. Membuka proyek, nomor/status/nilai PO Customer, Material, serta BoQ dan harga satuan. Berlaku untuk seluruh proyek nonarsip, termasuk proyek baru. Tetap hanya baca.</p>
  <p className="text-sm">Tidak mengubah izin Finance, dokumen, SPH, Time Plan, Target Tim atau operasional lainnya. Saat aktif, empat izin tersebut berlaku meski pengaturan per proyek di bawah tidak dicentang. Nonaktifkan akses global sebelum membatasi proyek tertentu.</p>
  <input type="hidden" name="userId" value={userId}/><input type="hidden" name="portfolioVersion" value={version}/><input type="hidden" name="enabled" value={String(!enabled)}/>
  <button disabled={pending} className={buttonClass}>{pending?'Menyimpan…':enabled?'Nonaktifkan akses semua proyek':'Aktifkan semua proyek + PO + Material + BoQ'}</button>
  <MutationFeedback state={state}/>
 </form>;
}

export function ViewerBulkForm({userId,snapshot,count}:{userId:string;snapshot:string;count:number}) {
 const [state,action,pending]=useActionState(grantViewerCurrentProjects,idleState);
 return <form action={action} className="space-y-3 rounded border bg-slate-50 p-4">
  <h3 className="font-semibold">Terapkan sekaligus ke {count} proyek yang dikelola</h3>
  <p className="text-sm">Tambahkan akses baca Proyek, PO Customer, Material dan BoQ. Izin lainnya tetap. Hanya proyek saat ini; proyek baru perlu diterapkan kembali. Pengaturan per proyek tetap bisa diubah setelahnya.</p>
  <input type="hidden" name="userId" value={userId}/><input type="hidden" name="permissionSnapshot" value={snapshot}/>
  <button disabled={pending||count===0} className={buttonClass}>{pending?'Menyimpan…':'Berikan akses sekaligus'}</button><MutationFeedback state={state}/>
 </form>;
}
