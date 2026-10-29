'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveDailyTarget, completeDailyTarget } from '@/app/actions/team-targets';
import { Field,inputClass,buttonClass,panelClass,MutationFeedback } from './workspace-ui';
import { idleState } from '@/lib/operations/validation';
import { addDays, weekStart, dailyAchievement, dailyShareText, dailyStatuses,dailyStatusLabels,priorities,priorityLabels,type DailyTargetRow } from '@/lib/team-targets/model';

type ProjectOption={id:string;label:string;canEdit:boolean};
type Props={start:string;today:string;requestId:string;isAdmin:boolean;demo:boolean;canCreate:boolean;projects:ProjectOption[];tasks:DailyTargetRow[]};
const dayNames=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
function dateLabel(date:string){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));}
function TargetForm({task,projects,isAdmin,requestId,date}:{task?:DailyTargetRow;projects:ProjectOption[];isAdmin:boolean;requestId:string;date:string}) {
  const [state,action,pending]=useActionState(saveDailyTarget,idleState);
  return <form action={action} className="mt-4 space-y-4 text-left">
    <input type="hidden" name="id" value={task?.id??''}/><input type="hidden" name="version" value={task?.version??0}/><input type="hidden" name="requestId" value={task?.requestId??requestId}/>
    <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{task?<><input type="hidden" name="projectId" value={task.projectId}/><p className="break-words text-sm">{task.projectLabel}</p></>:<Field label="Site / proyek"><select className={inputClass} name="projectId" required={!isAdmin} defaultValue=""><option value="">{isAdmin?'Aktivitas umum (Admin / Project Manager)':'Pilih proyek'}</option>{projects.filter(p=>p.canEdit).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>}</div>
      <div className="sm:col-span-2"><Field label="Nama aktivitas"><textarea name="title" className={inputClass} required minLength={3} maxLength={500} defaultValue={task?.title}/></Field></div>
      <Field label="Nama PIC / anggota tim (tidak perlu akun)"><input name="pic" className={inputClass} required maxLength={160} defaultValue={task?.pic}/></Field>
      <Field label="Tanggal target"><input name="scheduledDate" className={inputClass} type="date" min="2000-01-01" max="2100-12-31" required defaultValue={task?.scheduledDate??date}/></Field>
      <Field label="Target quantity"><input name="targetQty" className={inputClass} type="number" min="0.0001" step="0.0001" required defaultValue={task?.targetQty??'1'}/></Field>
      <Field label="Realisasi quantity"><input name="actualQty" className={inputClass} type="number" min="0" step="0.0001" required defaultValue={task?.actualQty??'0'}/></Field>
      <Field label="Satuan (unit, dokumen, aktivitas, dll.)"><input name="unit" className={inputClass} required maxLength={40} defaultValue={task?.unit??'aktivitas'}/></Field>
      <Field label="Prioritas"><select name="priority" className={inputClass} defaultValue={task?.priority??'MEDIUM'}>{priorities.map(s=><option key={s} value={s}>{priorityLabels[s]}</option>)}</select></Field>
      <Field label="Status"><select name="status" className={inputClass} defaultValue={task?.status??'NOT_STARTED'}>{dailyStatuses.map(s=><option key={s} value={s}>{dailyStatusLabels[s]}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field label="Catatan kendala / tindak lanjut / alasan pembatalan"><textarea name="notes" className={inputClass} maxLength={4000} defaultValue={task?.notes}/></Field></div>
      {task&&<div className="sm:col-span-2"><Field label="Alasan perubahan tanggal (wajib bila jadwal berubah)"><textarea name="rescheduleReason" className={inputClass} maxLength={1000}/></Field></div>}
      <button className={buttonClass}>{pending?'Menyimpan…':'Simpan target harian'}</button>
    </fieldset>
    <MutationFeedback state={state}/>
  </form>;
}
function CompleteForm({task}:{task:DailyTargetRow}) {
  const [state,action,pending]=useActionState(completeDailyTarget,idleState);
  return <form action={action} className="mt-3 space-y-2"><input type="hidden" name="id" value={task.id}/><input type="hidden" name="version" value={task.version}/><label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" name="confirm" value="yes" required className="mt-1"/>Target sudah tercapai (realisasi minimal {task.targetQty} {task.unit})</label><button className={buttonClass} disabled={pending}>{pending?'Menyimpan…':'Tandai selesai'}</button><MutationFeedback state={state}/></form>;
}
function TaskCard({task,props}:{task:DailyTargetRow;props:Props}) {
  const late=task.scheduledDate<props.today && !['DONE','CANCELLED'].includes(task.status);
  return <article className={`min-w-0 rounded border bg-white p-3 text-slate-800 ${late?'border-red-300':'border-slate-200'}`}>
    <div className="flex flex-wrap justify-between gap-2 text-xs"><span className={task.status==='DONE'?'font-semibold text-teal-800':task.status==='BLOCKED'?'font-semibold text-red-700':'text-slate-600'}>{dailyStatusLabels[task.status]}</span><span>{priorityLabels[task.priority]}</span></div>
    <h3 className={`mt-2 break-words text-sm font-semibold ${task.status==='DONE'?'text-slate-500 line-through':''}`}>{task.title}</h3>
    <p className="mt-2 break-words text-xs leading-5 text-slate-600">{task.projectLabel}<br/>PIC: <strong>{task.pic}</strong></p>
    <p className="mt-2 break-words text-sm">{task.actualQty} / {task.targetQty} {task.unit}</p>
    {late&&<p className="mt-1 text-xs font-semibold text-red-700">Belum selesai · target {dateLabel(task.scheduledDate)}</p>}
    {task.scheduledDate!==task.originalDate&&<p className="mt-1 text-xs text-amber-800">Dijadwalkan ulang · awal {dateLabel(task.originalDate)}</p>}
    {task.notes&&<p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{task.notes}</p>}
    {task.canEdit&&!['DONE','CANCELLED'].includes(task.status)&&<CompleteForm task={task}/>}
    {task.canEdit&&<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-teal-800">Ubah / jadwalkan ulang</summary><TargetForm key={`${task.id}-${task.version}`} task={task} projects={props.projects} isAdmin={props.isAdmin} requestId={task.requestId} date={task.scheduledDate}/></details>}
    <details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-600">Riwayat aktivitas</summary><ul className="mt-2 space-y-2">{task.history.map((h,i)=><li key={i} className="break-words border-t pt-2"><span className="font-semibold">{h.actor}</span> · {new Intl.DateTimeFormat('id-ID',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(h.at))}<br/>{h.description}</li>)}</ul><p className="mt-2 text-slate-500">Menampilkan riwayat dari 200 perubahan terbaru pada aktivitas yang dimuat.</p></details>
  </article>;
}
export function TeamTargetsWorkspace(props:Props) {
  const [pic,setPic]=useState(''); const [projectId,setProjectId]=useState('ALL');
  const [requestedShareDate,setShareDate]=useState(props.today>=props.start&&props.today<=addDays(props.start,6)?props.today:props.start);
  const [copyStatus,setCopyStatus]=useState('');
  const filtered=props.tasks.filter(t=>(projectId==='ALL'||t.projectId===projectId)&&t.pic.toLocaleLowerCase('id-ID').includes(pic.toLocaleLowerCase('id-ID')));
  const end=addDays(props.start,6);
  const weekly=filtered.filter(t=>t.scheduledDate>=props.start&&t.scheduledDate<=end);
  const today=dailyAchievement(filtered.filter(t=>t.scheduledDate===props.today));
  const summary=dailyAchievement(weekly);
  const backlog=filtered.filter(t=>t.scheduledDate<props.start&&!['DONE','CANCELLED'].includes(t.status));
  const notes=weekly.filter(t=>t.notes && t.status!=='CANCELLED');
  const shareDate=requestedShareDate>=props.start&&requestedShareDate<=end?requestedShareDate:props.start;
  const shareText=dailyShareText(shareDate,filtered);
  async function copySummary() {
    try { await navigator.clipboard.writeText(shareText); setCopyStatus('Ringkasan tersalin. Buka grup WhatsApp tim, tempel, periksa penerima, lalu kirim.'); }
    catch { setCopyStatus('Salin otomatis tidak tersedia. Pilih teks pratinjau di bawah lalu salin secara manual.'); }
  }
  return <main className="mx-auto min-w-0 max-w-[1800px] space-y-5 p-4 pb-24 md:p-7">
    <header className="bg-[#17364a] p-5 text-white md:p-7"><p className="text-sm text-white/70">PT. Arsko Sukses Bersama</p><h1 className="mt-2 text-2xl font-semibold">Target Tim — rencana harian & mingguan</h1><p className="mt-2">{dateLabel(props.start)} – {dateLabel(end)}</p><p className="mt-3 text-sm leading-6 text-white/80">PIC dapat diisi nama anggota tanpa akun. Pencapaian harian tidak mengubah progress proyek atau Time Plan.</p></header>
    {props.demo&&<p className="bg-amber-50 p-4 text-amber-900">Mode demo hanya baca. Aktifkan database untuk mencatat target tim.</p>}
    <details className={panelClass}><summary className="cursor-pointer font-semibold">Bagikan target ke grup WhatsApp</summary><p className="my-3 text-sm text-slate-600">Gratis tanpa integrasi berbayar. Jadwal yang disepakati: Senin–Jumat pukul 09.00 WIB. Tidak ada pengiriman atau pengingat otomatis. Periksa ringkasan dan pastikan anggota grup boleh menerima informasi ini.</p><Field label="Tanggal ringkasan (minggu terpilih)"><select className={inputClass} value={shareDate} onChange={e=>{setShareDate(e.target.value);setCopyStatus('');}}>{dayNames.map((name,i)=><option key={name} value={addDays(props.start,i)}>{name} · {dateLabel(addDays(props.start,i))}</option>)}</select></Field><textarea aria-label="Pratinjau pesan WhatsApp" readOnly value={shareText} className={`${inputClass} my-3 min-h-64 whitespace-pre-wrap`}/><button type="button" className={buttonClass} onClick={copySummary}>Salin ringkasan untuk WhatsApp</button><p role="status" className="mt-2 text-sm">{copyStatus}</p></details>
    <div className="flex flex-wrap items-end justify-between gap-3"><nav aria-label="Pilih minggu" className="flex flex-wrap gap-2"><Link className="border bg-white px-3 py-2 text-sm" href={`/team-targets?week=${addDays(props.start,-7)}`}>← Minggu sebelumnya</Link><Link className="border bg-white px-3 py-2 text-sm" href={`/team-targets?week=${weekStart(props.today)}`}>Minggu ini</Link><Link className="border bg-white px-3 py-2 text-sm" href={`/team-targets?week=${addDays(props.start,7)}`}>Minggu berikutnya →</Link></nav><form action="/team-targets" className="flex items-end gap-2"><Field label="Lompat ke tanggal"><input className={inputClass} type="date" name="week" min="2000-01-01" max="2100-12-31" defaultValue={props.start} required/></Field><button className={buttonClass}>Tampilkan</button></form></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Filter nama PIC"><input className={inputClass} value={pic} onChange={e=>setPic(e.target.value)} placeholder="Cari nama anggota tim"/></Field><Field label="Filter proyek"><select className={inputClass} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="ALL">Semua yang dapat diakses</option>{props.isAdmin&&<option value="">Aktivitas umum</option>}{props.projects.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Target hari ini',String(today.count),dateLabel(props.today)],['Selesai hari ini',String(today.done),`${today.remaining} aktivitas belum selesai`],['Pencapaian hari ini',`${today.percent.toFixed(1)}%`,'Rata-rata realisasi / target per aktivitas'],['Pencapaian minggu terpilih',`${summary.percent.toFixed(1)}%`,`${summary.done} / ${summary.count} aktivitas selesai`],
    ].map(([label,value,note])=><section key={label} className={`${panelClass} text-center`}><p className="text-sm text-slate-600">{label}</p><p className="my-2 text-3xl font-semibold">{value}</p><p className="text-xs text-slate-500">{note}</p></section>)}</div>
    <p className="text-xs leading-5 text-slate-600">Persentase memakai rata-rata pencapaian tiap aktivitas, maksimal 100% per aktivitas; quantity berbeda satuan tidak dijumlahkan. Aktivitas dibatalkan tidak dihitung. Semua ringkasan mengikuti filter. “Selesai hari ini” berarti aktivitas dengan tanggal target hari ini yang sudah selesai.</p>
    {props.canCreate&&(props.isAdmin||props.projects.some(p=>p.canEdit))&&<details className={panelClass}><summary className="cursor-pointer font-semibold">+ Tambah target harian</summary><p className="mt-2 text-xs text-slate-500">Untuk pekerjaan tanpa quantity, gunakan target 1 dengan satuan aktivitas. Input yang belum disimpan akan hilang saat pindah minggu atau memuat ulang.</p><TargetForm key={props.requestId} projects={props.projects} isAdmin={props.isAdmin} requestId={props.requestId} date={props.today>=props.start&&props.today<=end?props.today:props.start}/></details>}
    <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">{dayNames.map((name,index)=>{
      const date=addDays(props.start,index);const rows=weekly.filter(t=>t.scheduledDate===date);const progress=dailyAchievement(rows);
      return <section key={date} className={`min-w-0 rounded border p-3 ${date===props.today?'border-teal-500 bg-teal-50/50':'border-slate-200 bg-slate-100'}`}><header className="mb-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{name}{date===props.today?' · Hari ini':''}</h2><span className="text-sm">{progress.percent.toFixed(1)}%</span></div><p className="mt-1 text-xs text-slate-500">{dateLabel(date)} · {progress.done}/{progress.count} selesai</p><progress className="mt-2 h-2 w-full accent-teal-600" max={100} value={progress.percent} aria-label={`Pencapaian ${name}`}/></header><div className="space-y-3">{rows.map(task=><TaskCard key={task.id} task={task} props={props}/>)}{!rows.length&&<p className="py-8 text-center text-sm text-slate-500">Belum ada target.</p>}</div></section>;
    })}<section className="min-w-0 rounded border border-slate-200 bg-white p-4"><h2 className="font-semibold">Catatan & kendala minggu ini</h2><div className="mt-3 space-y-3">{notes.map(t=><div key={t.id} className="break-words border-b pb-3 text-sm"><p className="font-semibold">{t.pic} · {dateLabel(t.scheduledDate)}</p><p className="mt-1 whitespace-pre-wrap">{t.notes}</p></div>)}{!notes.length&&<p className="text-sm text-slate-500">Belum ada catatan. Tambahkan melalui aktivitas terkait.</p>}</div></section></div>
    <section className={panelClass}><h2 className="font-semibold">Belum selesai sebelum minggu ini ({backlog.length})</h2><p className="mt-2 text-sm text-slate-600">Tidak dipindahkan otomatis. Perbarui realisasi atau jadwalkan ulang dengan alasan.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{backlog.map(task=><TaskCard key={task.id} task={task} props={props}/>)}</div>{!backlog.length&&<p className="mt-3 text-sm text-slate-500">Tidak ada aktivitas tertunda dari minggu sebelumnya.</p>}</section>
  </main>;
}
