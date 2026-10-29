'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, isLocalDemoMode, type CurrentUser } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import { dailyTargetSchema } from '@/lib/team-targets/model';
import type { MutationState } from '@/lib/operations/validation';
import { Prisma, type DailyTarget } from '@/generated/prisma/client';

function snapshot(t: DailyTarget) {
  return { title:t.title, pic:t.pic, scheduledDate:t.scheduledDate.toISOString().slice(0,10), targetQty:t.targetQty.toString(), actualQty:t.actualQty.toString(), unit:t.unit, priority:t.priority, status:t.status, notes:t.notes, version:t.version };
}
async function authorizeProject(tx: Prisma.TransactionClient, projectId: string | null, user: CurrentUser) {
  if (!projectId) { if (!hasFullAccess(user.role)) throw new Error('Aktivitas umum tanpa proyek hanya dapat dikelola Admin atau Project Manager.'); return; }
  const p = await lockEditableProject(tx,projectId,user);
  if (['CLOSED','CANCELLED'].includes(p.status)) throw new Error('Proyek sudah ditutup/dibatalkan. Buka kembali proyek sebelum mengubah target.');
}
async function lockedTarget(tx: Prisma.TransactionClient, id:string, version:number, user:CurrentUser) {
  // Project first, then target: consistent with project operations; project cannot be reassigned.
  const found = await tx.dailyTarget.findUnique({where:{id}});
  if (!found) throw new Error('Aktivitas tidak ditemukan atau akses ditolak.');
  await authorizeProject(tx,found.projectId,user);
  await tx.$queryRaw`SELECT "id" FROM "DailyTarget" WHERE "id"=${id} FOR UPDATE`;
  const task = await tx.dailyTarget.findUniqueOrThrow({where:{id}});
  if (task.version !== version) throw new Error('Aktivitas sudah berubah. Muat ulang sebelum menyimpan.');
  return task;
}
function failure(e:unknown):MutationState {
  return {status:'error',message:e instanceof Error && !('code' in e) ? e.message : 'Target belum dapat disimpan. Muat ulang dan coba lagi.'};
}
export async function saveDailyTarget(_:MutationState,form:FormData):Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode()) return {status:'error',message:'Akses ubah Target Tim ditolak.'};
  const parsed = dailyTargetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return {status:'error',message:parsed.error.issues.map(i=>i.message).join(' ')};
  try {
    const message = await prisma.$transaction(async tx => {
      const {id,requestId,version,projectId,rescheduleReason,...fields} = parsed.data;
      const old = id ? await lockedTarget(tx,id,version,user) : null;
      if (old && (old.projectId ?? '') !== projectId) throw new Error('Proyek aktivitas tidak dapat diganti. Batalkan aktivitas lama dan buat baru.');
      if (!old) {
        await authorizeProject(tx,projectId || null,user);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`daily:${requestId}`},0))`;
        const existing = await tx.dailyTarget.findUnique({where:{requestId}});
        if (existing) {
          if (existing.createdById !== user.id) throw new Error('Permintaan tidak valid. Muat ulang.');
          return 'Permintaan ini sudah tersimpan. Tidak dibuat aktivitas ganda.';
        }
      }
      if (old && old.scheduledDate.toISOString().slice(0,10) !== fields.scheduledDate && !rescheduleReason) throw new Error('Isi alasan perubahan jadwal agar riwayat target tetap jelas.');
      const data = {...fields, scheduledDate:new Date(`${fields.scheduledDate}T00:00:00Z`), completedAt:fields.status === 'DONE' ? (old?.completedAt ?? new Date()) : null};
      const saved = old ? await tx.dailyTarget.update({where:{id},data:{...data,version:{increment:1}}}) : await tx.dailyTarget.create({data:{...data, requestId, projectId:projectId || null, createdById:user.id, originalDate:data.scheduledDate}});
      await tx.auditLog.create({data:{userId:user.id,projectId:saved.projectId,entityType:'DailyTarget',entityId:saved.id,action:old?'DAILY_TARGET_UPDATED':'DAILY_TARGET_CREATED',metadata:{before:old?snapshot(old):null,after:snapshot(saved),rescheduleReason}}});
      return 'Target harian tersimpan. Progress proyek tidak diubah.';
    },{timeout:15000});
    revalidatePath('/team-targets'); return {status:'success',message};
  } catch(e) {return failure(e);}
}
export async function completeDailyTarget(_:MutationState,form:FormData):Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode()) return {status:'error',message:'Akses ubah Target Tim ditolak.'};
  const parsed = z.object({id:z.string().min(1).max(100),version:z.coerce.number().int().min(1),confirm:z.literal('yes')}).safeParse(Object.fromEntries(form));
  if (!parsed.success) return {status:'error',message:'Konfirmasi bahwa target aktivitas sudah tercapai.'};
  try {
    await prisma.$transaction(async tx=>{
      const old=await lockedTarget(tx,parsed.data.id,parsed.data.version,user);
      if (old.status==='CANCELLED') throw new Error('Aktivitas dibatalkan. Buka kembali melalui form ubah.');
      const saved=await tx.dailyTarget.update({where:{id:old.id},data:{status:'DONE',actualQty:Prisma.Decimal.max(old.actualQty,old.targetQty),completedAt:old.completedAt??new Date(),version:{increment:1}}});
      await tx.auditLog.create({data:{userId:user.id,projectId:old.projectId,entityType:'DailyTarget',entityId:old.id,action:'DAILY_TARGET_COMPLETED',metadata:{before:snapshot(old),after:snapshot(saved)}}});
    },{timeout:15000});
    revalidatePath('/team-targets'); return {status:'success',message:'Aktivitas selesai. Realisasi minimal disamakan dengan target; progress proyek tetap.'};
  }catch(e){return failure(e);}
}
