import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth/require-user';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import { addDays, calendarDate, weekStart } from '@/lib/team-targets/model';
import { TeamTargetsWorkspace } from '@/components/modules/team-targets-workspace';

export const metadata = { title:'Target Tim' };
export default async function TeamTargetsPage({searchParams}:{searchParams:Promise<{week?:string}>}) {
  const user=await requireUser();
  const params=await searchParams;
  const today=dateOnlyInTimeZone(new Date(),process.env.APP_TIME_ZONE || 'Asia/Jakarta').toISOString().slice(0,10);
  const start=weekStart(calendarDate.safeParse(params.week).success ? params.week! : today);
  const end=addDays(start,6);
  const demo=isLocalDemoMode();
  const [projects,tasks]=demo ? [[],[]] : await Promise.all([
    prisma.project.findMany({where:accessibleProjectWhere(user),orderBy:{code:'asc'},select:{id:true,code:true,name:true,status:true,projectManagerId:true}}),
    prisma.dailyTarget.findMany({where:{
      AND:[
        {OR:[{project:{is:accessibleProjectWhere(user)}},...(user.role==='ADMIN'?[{projectId:null}]:[])]},
        {OR:[{scheduledDate:{gte:new Date(`${start}T00:00:00Z`),lte:new Date(`${end}T00:00:00Z`)}},{scheduledDate:{lt:new Date(`${start}T00:00:00Z`)},status:{notIn:['DONE','CANCELLED']}},{scheduledDate:new Date(`${today}T00:00:00Z`)}]},
      ],
    },orderBy:[{scheduledDate:'asc'},{createdAt:'asc'}],include:{project:{select:{code:true,name:true,status:true,projectManagerId:true}}}}),
  ]);
  const logs=tasks.length ? await prisma.auditLog.findMany({where:{entityType:'DailyTarget',entityId:{in:tasks.map(t=>t.id)}},orderBy:{createdAt:'desc'},take:200,include:{user:{select:{displayName:true}}}}) : [];
  return <TeamTargetsWorkspace start={start} today={today} requestId={randomUUID()} isAdmin={user.role==='ADMIN'} demo={demo} canCreate={!demo && user.role!=='VIEWER'} projects={projects.map(p=>({id:p.id,label:`${p.code} — ${p.name}`,canEdit:!['CLOSED','CANCELLED'].includes(p.status) && (user.role==='ADMIN' || (user.role==='PROJECT_MANAGER' && p.projectManagerId===user.id))}))} tasks={tasks.map(t=>({
    id:t.id,requestId:t.requestId,version:t.version,projectId:t.projectId??'',projectLabel:t.project?`${t.project.code} — ${t.project.name}`:'Aktivitas umum (Admin)',
    title:t.title,pic:t.pic,scheduledDate:t.scheduledDate.toISOString().slice(0,10),originalDate:t.originalDate.toISOString().slice(0,10),
    targetQty:t.targetQty.toString(),actualQty:t.actualQty.toString(),unit:t.unit,priority:t.priority,status:t.status,notes:t.notes,
    canEdit:!demo && (user.role==='ADMIN'||(user.role==='PROJECT_MANAGER'&&t.project?.projectManagerId===user.id)) && (!t.project||!['CLOSED','CANCELLED'].includes(t.project.status)),
    history:logs.filter(l=>l.entityId===t.id).map(l=>{
      const meta=l.metadata as {before?:{scheduledDate?:string;status?:string;actualQty?:string};after?:{scheduledDate?:string;status?:string;actualQty?:string};rescheduleReason?:string}|null;
      const moved=meta?.before?.scheduledDate && meta.after?.scheduledDate && meta.before.scheduledDate!==meta.after.scheduledDate;
      return {at:l.createdAt.toISOString(),actor:l.user?.displayName??'Sistem',description:moved?`Jadwal ${meta.before!.scheduledDate} → ${meta.after!.scheduledDate}. Alasan: ${meta.rescheduleReason??'—'}`:`${l.action==='DAILY_TARGET_CREATED'?'Dibuat':'Diperbarui'} · ${meta?.after?.status??''} · realisasi ${meta?.after?.actualQty??''}`};
    }),
  }))} />;
}
