import 'server-only';
import { hasFullAccess } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import type { CurrentUser } from '@/lib/auth/session';
import type { Prisma } from '@/generated/prisma/client';
import { dailyAchievement } from '@/lib/team-targets/model';
import { quotationSummary, quotationLabels, rupiah, moneyCents } from '@/lib/quotations/model';

export async function getOverview(user: CurrentUser, today: Date) {
  const scope = accessibleProjectWhere(user);
  const active = { ...scope, status: 'ACTIVE' as const };
  const dailyScope: Prisma.DailyTargetWhereInput = { OR: [{ project: { is: scope } }, ...(hasFullAccess(user.role) ? [{ projectId: null }] : [])] };
  const [daily, overdue, queue, boq, plans, milestones, documents, actions, phases, quotes] = await Promise.all([
    prisma.dailyTarget.findMany({where:{AND:[dailyScope,{scheduledDate:today,status:{not:'CANCELLED'}}]},select:{targetQty:true,actualQty:true,status:true}}),
    prisma.dailyTarget.count({where:{AND:[dailyScope,{scheduledDate:{lt:today},status:{notIn:['DONE','CANCELLED']}}]}}),
    prisma.dailyTarget.findMany({where:{AND:[dailyScope,{scheduledDate:{lte:today},status:{notIn:['DONE','CANCELLED']}}]},orderBy:[{scheduledDate:'asc'},{createdAt:'asc'}],take:5,select:{id:true,title:true,pic:true,scheduledDate:true,project:{select:{code:true}}}}),
    prisma.boq.groupBy({by:['status'],where:{project:{is:scope}},_count:{_all:true}}),
    prisma.planTask.count({where:{project:{is:active},archivedAt:null,plannedFinish:{lt:today},progressPct:{lt:100}}}),
    prisma.milestone.groupBy({by:['phase'],where:{project:{is:active},status:{not:'COMPLETED'}},_count:{_all:true}}),
    prisma.document.count({where:{project:{is:scope},deletedAt:null,status:'READY'}}),
    prisma.actionItem.count({where:{project:{is:active},status:{not:'RESOLVED'}}}),
    prisma.project.groupBy({by:['phase'],where:active,_count:{_all:true}}),
    hasFullAccess(user.role)?prisma.quotation.findMany({select:{status:true,value:true,projects:{select:{id:true,code:true,customerPoNumber:true,customerPoStatus:true,poValue:true,deletedAt:true}}}}):Promise.resolve(null),
  ]);
  const achievement=dailyAchievement(daily.map(t=>({...t,targetQty:t.targetQty.toString(),actualQty:t.actualQty.toString()})));
  const phaseCount=(phase:string)=>phases.find(p=>p.phase===phase)?._count._all??0;
  const pending=(phase:string)=>milestones.find(p=>p.phase===phase)?._count._all??0;
  const quoteRows=quotes?.map(q=>({...q,value:q.value.toFixed(2),summary:quotationSummary({...q,value:q.value.toFixed(2),projects:q.projects.map(p=>({...p,poValue:p.poValue.toFixed(2),deletedAt:p.deletedAt?.toISOString()??null}))})}));
  return {
    date:today.toISOString().slice(0,10), achievement, overdue,
    queue:queue.map(t=>({...t,scheduledDate:t.scheduledDate.toISOString().slice(0,10),project:t.project?.code??'Aktivitas umum'})),
    modules:[
      {label:'BoQ',value:boq.filter(b=>b.status==='APPROVED').reduce((s,b)=>s+b._count._all,0),unit:'revisi approved',note:`${boq.find(b=>b.status==='DRAFT')?._count._all??0} revisi draft`,href:'/boq'},
      {label:'Time Plan',value:plans,unit:'pekerjaan terlambat',note:'Proyek aktif · belum mencapai 100%',href:'/time-plan'},
      {label:'Produksi',value:phaseCount('PRODUCTION'),unit:'proyek di fase produksi',note:'Proyek aktif',href:'/production'},
      {label:'FAT',value:pending('FAT'),unit:'milestone belum selesai',note:`${phaseCount('FAT')} proyek aktif di fase FAT`,href:'/fat'},
      {label:'Delivery',value:pending('DELIVERY'),unit:'milestone belum selesai',note:`${phaseCount('DELIVERY')} proyek aktif di fase delivery`,href:'/delivery'},
      {label:'Site Work / BAST',value:pending('INSTALLATION')+pending('BAST'),unit:'milestone belum selesai',note:`${phaseCount('INSTALLATION')+phaseCount('BAST')} proyek aktif di fase site / BAST`,href:'/site-work'},
      {label:'Action Center',value:actions,unit:'tindak lanjut terbuka',note:'Proyek aktif · termasuk terhambat',href:'/actions'},
      {label:'Dokumen',value:documents,unit:'dokumen siap',note:'Seluruh proyek yang dapat diakses',href:'/projects'},
    ],
    quotations:quoteRows?Object.entries(quotationLabels).map(([status,label])=>{
      const rows=quoteRows.filter(q=>q.summary.status===status);
      return {label,count:rows.length,value:rupiah(rows.reduce((sum,q)=>sum+moneyCents(q.value),0n))};
    }):null,
  };
}
