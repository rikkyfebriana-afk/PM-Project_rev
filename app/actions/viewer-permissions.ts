'use server';
import {revalidatePath} from 'next/cache';
import {getCurrentUser,isLocalDemoMode} from '@/lib/auth/session';
import {prisma} from '@/lib/prisma';
import {lockEditableProject} from '@/lib/operations/transaction';
import {validateViewerScopes,addPortfolioScopes} from '@/lib/viewer-permissions/model';
import {editableProjectWhere} from '@/lib/projects/access';
import {permissionSnapshot} from '@/lib/viewer-permissions/snapshot';
import type {MutationState} from '@/lib/operations/validation';
export async function saveViewerPermission(_:MutationState,form:FormData):Promise<MutationState> {
 const actor=await getCurrentUser();
 if(!actor||actor.role==='VIEWER'||isLocalDemoMode()) return {status:'error',message:'Akses pengaturan izin ditolak.'};
 const userId=String(form.get('userId')??''),projectId=String(form.get('projectId')??''),version=Number(form.get('version'));
 if(!userId||!projectId||!Number.isSafeInteger(version)||version<0) return {status:'error',message:'Data izin tidak valid.'};
 try {
  const scopes=validateViewerScopes(form.getAll('scopes').map(String));
  await prisma.$transaction(async tx=>{
   await lockEditableProject(tx,projectId,actor);
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
   const target=await tx.user.findUnique({where:{id:userId}});
   if(!target||target.role!=='VIEWER'||!target.isActive) throw new Error('Pilih akun Viewer aktif.');
   const old=await tx.viewerPermission.findUnique({where:{userId_projectId:{userId,projectId}}});
   if((old?.version??0)!==version) throw new Error('Izin sudah berubah. Muat ulang sebelum menyimpan.');
   const saved=await tx.viewerPermission.upsert({where:{userId_projectId:{userId,projectId}},create:{userId,projectId,scopes},update:{scopes,version:{increment:1}}});
   await tx.auditLog.create({data:{userId:actor.id,projectId,entityType:'ViewerPermission',entityId:userId,action:'VIEWER_PERMISSION_UPDATED',metadata:{before:old?.scopes??['PROJECT','PO'],after:scopes,version:saved.version}}});
  },{timeout:15000});
  revalidatePath('/','layout');
  return {status:'success',message:'Izin Viewer tersimpan. Berlaku pada permintaan halaman berikutnya.'};
 }catch(e){return {status:'error',message:e instanceof Error&&!('code' in e)?e.message:'Izin belum dapat disimpan.'};}
}

export async function saveViewerPortfolioAccess(_:MutationState,form:FormData):Promise<MutationState> {
 const actor=await getCurrentUser();
 if(!actor||actor.role!=='ADMIN'||isLocalDemoMode()) return {status:'error',message:'Hanya Admin yang dapat mengatur semua proyek termasuk proyek baru.'};
 const userId=String(form.get('userId')??''),version=Number(form.get('portfolioVersion'));
 const enabled=form.get('enabled');
 if(!userId||!Number.isSafeInteger(version)||version<0||!['true','false'].includes(String(enabled))) return {status:'error',message:'Data izin tidak valid.'};
 try {
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
   const target=await tx.user.findUnique({where:{id:userId}});
   if(!target||target.role!=='VIEWER'||!target.isActive) throw new Error('Pilih akun Viewer aktif.');
   if(target.viewerAccessVersion!==version) throw new Error('Izin sudah berubah. Muat ulang sebelum menyimpan.');
   await tx.user.update({where:{id:userId},data:{viewerPortfolioAccess:enabled==='true',viewerAccessVersion:{increment:1}}});
   await tx.auditLog.create({data:{userId:actor.id,entityType:'ViewerPermission',entityId:userId,action:'VIEWER_PORTFOLIO_ACCESS_UPDATED',metadata:{before:target.viewerPortfolioAccess,after:enabled==='true',version:version+1}}});
  });
  revalidatePath('/','layout');
  return {status:'success',message:enabled==='true'?'Akses semua proyek, PO Customer, Material dan BoQ diaktifkan, termasuk proyek baru.':'Akses global dinonaktifkan. Izin per proyek sebelumnya kembali berlaku.'};
 }catch(e){return {status:'error',message:e instanceof Error&&!('code' in e)?e.message:'Izin belum dapat disimpan.'};}
}

export async function grantViewerCurrentProjects(_:MutationState,form:FormData):Promise<MutationState> {
 const actor=await getCurrentUser();
 if(!actor||!['ADMIN','PROJECT_MANAGER'].includes(actor.role)||isLocalDemoMode()) return {status:'error',message:'Akses pengaturan izin ditolak.'};
 const userId=String(form.get('userId')??''),snapshot=String(form.get('permissionSnapshot')??'');
 if(!userId||!snapshot) return {status:'error',message:'Data izin tidak valid.'};
 try {
  const count=await prisma.$transaction(async tx=>{
   const projects=await tx.project.findMany({where:editableProjectWhere(actor),select:{id:true},orderBy:{id:'asc'}});
   if(!projects.length) throw new Error('Belum ada proyek yang dapat diatur.');
   // Use the same project-then-user lock order as individual permission saves.
   for(const p of projects) await lockEditableProject(tx,p.id,actor);
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
   const target=await tx.user.findUnique({where:{id:userId}});
   if(!target||target.role!=='VIEWER'||!target.isActive) throw new Error('Pilih akun Viewer aktif.');
   const current=await tx.project.findMany({where:editableProjectWhere(actor),select:{id:true,viewerPermissions:{where:{userId},select:{version:true,scopes:true}}}});
   if(permissionSnapshot(current)!==snapshot) throw new Error('Izin atau daftar proyek sudah berubah. Muat ulang sebelum menyimpan.');
   for(const p of current){
    const old=p.viewerPermissions[0],scopes=addPortfolioScopes(old?.scopes);
    await tx.viewerPermission.upsert({where:{userId_projectId:{userId,projectId:p.id}},create:{userId,projectId:p.id,scopes},update:{scopes,version:{increment:1}}});
    await tx.auditLog.create({data:{userId:actor.id,projectId:p.id,entityType:'ViewerPermission',entityId:userId,action:'VIEWER_PERMISSION_BULK_GRANTED',metadata:{before:old?.scopes??['PROJECT','PO'],after:scopes}}});
   }
   return current.length;
  },{timeout:30000});
  revalidatePath('/','layout');
  return {status:'success',message:`Akses baca proyek, PO, Material dan BoQ diberikan pada ${count} proyek. Izin lain tidak berubah.`};
 }catch(e){return {status:'error',message:e instanceof Error&&!('code' in e)?e.message:'Izin belum dapat disimpan.'};}
}
