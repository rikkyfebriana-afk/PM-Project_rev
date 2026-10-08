'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveQuotation, linkQuotationPo } from '@/app/actions/quotations';
import { Field, inputClass, buttonClass, panelClass, MutationFeedback, WorkspaceIntro } from './workspace-ui';
import { idleState } from '@/lib/operations/validation';
import { quotationStatuses, quotationLabels, quotationSummary, moneyCents, rupiah, countedPo, type LinkedPo } from '@/lib/quotations/model';

type Quote = {
  id: string; number: string; clientName: string; title: string; value: string;
  issuedDate: string; sentDate: string; validUntil: string; followUpDate: string;
  status: string; pic: string; notes: string; version: number; projects: LinkedPo[];
};
type PoOption = { id: string; code: string; clientName: string | null; customerPoNumber: string | null };
function QuoteForm({ quote }: { quote?: Quote }) {
  const [state, action, pending] = useActionState(saveQuotation, idleState);
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="id" value={quote?.id ?? ''} />
    <input type="hidden" name="version" value={quote?.version ?? 0} />
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nomor SPH"><input className={inputClass} name="number" required maxLength={100} defaultValue={quote?.number} /></Field>
      <Field label="Customer"><input className={inputClass} name="clientName" required maxLength={160} defaultValue={quote?.clientName} /></Field>
      <Field label="PIC penawaran"><input className={inputClass} name="pic" required maxLength={160} defaultValue={quote?.pic} /></Field>
      <div className="sm:col-span-2 lg:col-span-3"><Field label="Nama pekerjaan"><textarea className={inputClass} name="title" required maxLength={500} defaultValue={quote?.title} /></Field></div>
      <Field label="Nilai SPH sebelum pajak (Rp)"><input className={inputClass} name="value" type="number" min="0.01" step="0.01" required defaultValue={quote?.value} /></Field>
      <Field label="Tanggal SPH"><input className={inputClass} name="issuedDate" type="date" required defaultValue={quote?.issuedDate} /></Field>
      <Field label="Tanggal dikirim"><input className={inputClass} name="sentDate" type="date" defaultValue={quote?.sentDate} /></Field>
      <Field label="Berlaku sampai"><input className={inputClass} name="validUntil" type="date" defaultValue={quote?.validUntil} /></Field>
      <Field label="Follow-up berikutnya"><input className={inputClass} name="followUpDate" type="date" defaultValue={quote?.followUpDate} /></Field>
      <Field label="Status penawaran"><select className={inputClass} name="status" defaultValue={quote?.status ?? 'DRAFT'}>{quotationStatuses.map(s => <option key={s} value={s}>{quotationLabels[s]}</option>)}</select></Field>
      <div className="sm:col-span-2 lg:col-span-3"><Field label="Catatan pengiriman / negosiasi / alasan selesai"><textarea className={inputClass} name="notes" maxLength={4000} defaultValue={quote?.notes} /></Field></div>
      <button className={buttonClass}>{pending ? 'Menyimpan…' : 'Simpan SPH'}</button>
    </fieldset>
    <MutationFeedback state={state} />
  </form>;
}
function LinkForm({ quote, projects, unlink }: { quote: Quote; projects: PoOption[]; unlink?: LinkedPo }) {
  const [state, action, pending] = useActionState(linkQuotationPo, idleState);
  const eligible = projects.filter(p => p.clientName?.trim().toLocaleLowerCase('id-ID') === quote.clientName.trim().toLocaleLowerCase('id-ID'));
  return <form action={action} className="mt-3 space-y-2">
    <input type="hidden" name="quotationId" value={quote.id} />
    <input type="hidden" name="version" value={quote.version} />
    <input type="hidden" name="operation" value={unlink ? 'unlink' : 'link'} />
    {unlink ? <><input type="hidden" name="projectId" value={unlink.id} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" required /> Konfirmasi lepas hubungan PO</label></> : <Field label="Pilih PO Customer untuk dihubungkan"><select className={inputClass} name="projectId" required defaultValue=""><option value="">Pilih PO customer yang sama</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.customerPoNumber} — {p.code}</option>)}</select></Field>}
    <button className={buttonClass} disabled={pending || (!unlink && !eligible.length)}>{pending ? 'Menyimpan…' : unlink ? 'Lepaskan PO' : '+ Hubungkan PO'}</button>
    {!unlink && !eligible.length && <p className="text-sm text-slate-600">Belum ada PO aktif dengan nama customer yang sama dan belum terhubung SPH. Catat terlebih dahulu di <Link className="underline" href="/customer-po">PO Customer</Link>.</p>}
    <MutationFeedback state={state} />
  </form>;
}
export function QuotationWorkspace({ quotes, projects }: { quotes: Quote[]; projects: PoOption[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const rows = quotes.map(q => ({ q, summary: quotationSummary(q) }));
  const visible = rows.filter(({q, summary}) => (filter === 'ALL' || summary.status === filter) && `${q.number} ${q.clientName} ${q.title} ${q.pic}`.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')));
  const groups = [
    { label: 'Belum dikirim', rows: rows.filter(r => r.summary.status === 'DRAFT') },
    { label: 'Terkirim · belum menjadi PO', rows: rows.filter(r => ['SENT', 'NEGOTIATION'].includes(r.summary.status)) },
    { label: 'Sebagian menjadi PO', rows: rows.filter(r => r.summary.status === 'PARTIAL') },
    { label: 'Selesai menjadi PO', rows: rows.filter(r => r.summary.status === 'WON') },
  ];
  return <main className="mx-auto min-w-0 max-w-[1600px] space-y-6 p-4 pb-24 md:p-7">
    <WorkspaceIntro title="Quotation / SPH" description="Kontrol penawaran ke customer: pencatatan pengiriman, follow-up, dan konversi satu SPH ke beberapa PO. Tidak mengirim email otomatis." demo={false} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map(g => <section key={g.label} className={`${panelClass} min-w-0 text-center`}><h2 className="text-sm text-slate-600">{g.label}</h2><p className="my-2 text-3xl font-semibold">{g.rows.length}</p><p className="break-words font-mono text-sm">{rupiah(g.rows.reduce((s, r) => s + moneyCents(r.q.value), 0n))}</p><p className="mt-2 text-xs text-slate-500">Nilai penawaran sebelum pajak</p></section>)}</div>
    <p className="text-sm text-slate-600">Nilai SPH bukan pendapatan. PO Draft, Dibatalkan, atau proyek diarsipkan tidak dihitung dalam konversi. Selisih nilai bukan piutang dan dapat negatif setelah negosiasi.</p>
    <details className={panelClass}><summary className="cursor-pointer font-semibold">+ Buat SPH baru</summary><QuoteForm /></details>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Cari nomor / customer / pekerjaan / PIC"><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} /></Field><Field label="Filter status"><select className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Semua status</option>{Object.entries(quotationLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
    <p className="text-sm text-slate-600">Menampilkan {visible.length} dari {quotes.length} SPH. Ringkasan di atas mencakup seluruh SPH.</p>
    {!visible.length && <p className={panelClass}>Belum ada SPH sesuai filter.</p>}
    {visible.map(({q, summary}) => <article key={q.id} className={`${panelClass} min-w-0 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 break-words"><p className="font-semibold text-orange-700">{q.number}</p><h2 className="mt-1 text-lg font-semibold">{q.title}</h2><p className="text-sm text-slate-600">{q.clientName} · PIC: {q.pic}</p></div><span className="bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900">{quotationLabels[summary.status]}</span></div>
      <div className="grid gap-3 text-center sm:grid-cols-3"><div>Nilai SPH<p className="break-words font-mono font-semibold">{rupiah(moneyCents(q.value))}</p></div><div>PO terkait ({summary.count})<p className="break-words font-mono font-semibold">{rupiah(summary.total)}</p></div><div>Selisih SPH − PO<p className="break-words font-mono font-semibold">{rupiah(summary.difference)}</p></div></div>
      <p className="text-sm text-slate-600">Tanggal SPH: {q.issuedDate} · Dikirim: {q.sentDate || 'Belum dikirim'} · Berlaku sampai: {q.validUntil || '—'} · Follow-up: {q.followUpDate || '—'}</p>
      {q.status === 'WON' && !summary.count && <p className="text-sm text-amber-800">PO terkait tidak lagi aktif. Periksa kembali status penawaran ini.</p>}
      {q.notes && <p className="whitespace-pre-wrap break-words text-sm">{q.notes}</p>}
      <details><summary className="cursor-pointer font-semibold">Ubah SPH / status</summary><p className="mt-2 text-sm text-slate-600">Sebagian menjadi PO dihitung otomatis. Pilih Selesai menjadi PO saat seluruh lingkup yang disepakati sudah dipesan.</p><QuoteForm key={`${q.id}-${q.version}`} quote={q} /></details>
      <details><summary className="cursor-pointer font-semibold">PO terkait ({q.projects.length}) / hubungkan PO</summary>
        {q.projects.map(p => <div key={p.id} className="mt-3 border p-3"><p className="break-words text-sm">{p.customerPoNumber || 'Tanpa nomor'} · {p.code} · {rupiah(moneyCents(p.poValue))} {!countedPo(p) && '— tidak dihitung'}</p>{!p.deletedAt && <LinkForm quote={q} projects={[]} unlink={p} />}</div>)}
        {['SENT','NEGOTIATION'].includes(q.status) ? <LinkForm quote={q} projects={projects} /> : <p className="mt-3 text-sm text-slate-600">Ubah status menjadi Terkirim atau Negosiasi untuk menautkan PO.</p>}
      </details>
    </article>)}
  </main>;
}
