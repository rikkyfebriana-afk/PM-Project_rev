import Link from 'next/link';
import type {CurrentUser} from '@/lib/auth/session';
import {prisma} from '@/lib/prisma';
import {accessibleProjectWhere} from '@/lib/projects/access';
import {exactPoMoney,summarizeFinancePo} from '@/lib/finance/po-summary';
import {PoMonthlyChart} from './po-monthly-chart';
import {buildMonthlyPo} from '@/lib/dashboard/po-monthly';
import {dateOnlyInTimeZone} from '@/lib/business-date';

export async function ViewerDashboard({user}:{user:CurrentUser}) {
 const [projects,po,documents]=await Promise.all([
  prisma.project.findMany({where:accessibleProjectWhere(user),orderBy:{code:'asc'},select:{id:true,code:true,name:true,status:true,health:true,phase:true,address:true,progressPct:true,plannedFinish:true}}),
  prisma.project.findMany({where:accessibleProjectWhere(user,'PO'),select:{id:true,poValue:true,customerPoNumber:true,customerPoStatus:true,customerPoDate:true,customerPoCompletedDate:true}}),
  prisma.document.findMany({where:{project:{is:accessibleProjectWhere(user,'DOCUMENTS')},deletedAt:null,status:'READY'},orderBy:{createdAt:'desc'},take:50,select:{id:true,originalName:true,project:{select:{code:true}}}}),
 ]);
 const poRows=po.map(p=>({...p,poValue:p.poValue.toFixed(2),customerPoDate:p.customerPoDate?.toISOString().slice(0,10)??null,customerPoCompletedDate:p.customerPoCompletedDate?.toISOString().slice(0,10)??null}));
 const summary=summarizeFinancePo(poRows);
 const active=projects.filter(p=>p.status==='ACTIVE');
 const today=dateOnlyInTimeZone(new Date(),process.env.APP_TIME_ZONE||'Asia/Jakarta');
 return <main className="mx-auto max-w-[1600px] space-y-5 p-5 pb-24"><header><h1 className="text-2xl font-semibold">Dashboard Viewer</h1><p className="mt-2 text-sm text-slate-600">Hanya baca. Proyek dan data ditampilkan sesuai izin Admin / Project Manager. Data sensitif lainnya tidak dikirim ke halaman ini.</p></header>
 <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['Active',active.length],['On track',active.filter(p=>p.health==='ON_TRACK').length],['Attention',active.filter(p=>p.health==='ATTENTION').length],['Critical',active.filter(p=>p.health==='CRITICAL').length],['Closed',projects.filter(p=>p.status==='CLOSED').length]].map(([label,count])=><section key={label} className="border bg-white p-4"><p>{label}</p><strong className="text-2xl">{count}</strong></section>)}</div>
 <section><h2 className="mb-3 text-lg font-semibold">PO Customer yang diizinkan</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{summary.map(s=><Link href="/customer-po" key={s.key} className="border bg-white p-4"><p>{s.label} · {s.count}</p><strong className="break-words font-mono">{exactPoMoney(s.value)}</strong></Link>)}</div></section>
 <PoMonthlyChart data={buildMonthlyPo(poRows,today.getUTCFullYear())}/>
 <nav className="flex flex-wrap gap-3">{[['/finance','Finance'],['/boq','BoQ'],['/time-plan','Time Plan'],['/team-targets','Target Tim'],['/materials','Material'],['/production','Produksi'],['/fat','FAT'],['/delivery','Delivery'],['/site-work','Site Work']].map(([href,label])=><Link className="border bg-white p-3 text-sm underline" key={href} href={href}>{label}</Link>)}</nav><p className="text-xs text-slate-600">Modul hanya menampilkan proyek yang izinnya dicentang. Tidak ada izin otomatis untuk data sensitif atau ekspor.</p>
 <section className="overflow-x-auto border bg-white"><h2 className="p-4 font-semibold">Daftar proyek — {projects.length}</h2><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-100"><tr>{['Proyek','Lokasi','Fase','Progress','Target selesai','Health','PO Customer','Nilai PO'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{projects.map(p=>{const allowedPo=poRows.find(r=>r.id===p.id);return <tr className="border-t" key={p.id}><td className="max-w-sm p-3"><strong>{p.code}</strong><p>{p.name}</p></td><td className="p-3">{p.address??'—'}</td><td className="p-3">{p.phase}</td><td className="p-3">{p.progressPct.toString()}%</td><td className="p-3">{p.plannedFinish?.toISOString().slice(0,10)??'—'}</td><td className="p-3">{p.health}</td><td className="p-3">{allowedPo?`${allowedPo.customerPoNumber??'Belum tercatat'} · ${allowedPo.customerPoStatus}`:'Tidak diizinkan'}</td><td className="whitespace-nowrap p-3">{allowedPo?exactPoMoney(allowedPo.poValue):'Tidak diizinkan'}</td></tr>;})}</tbody></table>{!projects.length&&<p className="p-4">Tidak ada proyek yang diizinkan.</p>}</section>
 <section className="border bg-white p-4"><h2 className="font-semibold">Dokumen yang diizinkan (50 terbaru)</h2>{documents.length?documents.map(d=><Link key={d.id} className="block py-2 text-sm underline" href={`/api/documents/${d.id}/download`}>{d.project.code} · {d.originalName}</Link>):<p className="mt-2 text-sm text-slate-600">Tidak ada dokumen yang diizinkan atau siap diunduh.</p>}</section>
 </main>;
}
