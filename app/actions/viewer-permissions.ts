'use server';
import {revalidatePath} from 'next/cache';
import {getCurrentUser,isLocalDemoMode} from '@/lib/auth/session';
import {prisma} from '@/lib/prisma';
import {lockEditableProject} from '@/lib/operations/transaction';
import {validateViewerScopes} from '@/lib/viewer-permissions/model';
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
