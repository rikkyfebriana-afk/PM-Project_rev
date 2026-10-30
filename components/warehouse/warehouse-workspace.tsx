'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Boxes, RotateCcw, Search } from 'lucide-react';
import { createWarehouseItem, receiveWarehouseStock, issueWarehouseStock, returnWarehouseStock } from '@/app/actions/warehouse';
import { idleState } from '@/lib/operations/validation';
import type { WarehouseWorkspaceData } from '@/lib/warehouse/types';
import { buttonClass, Field, inputClass, Metrics, MutationFeedback, panelClass } from '@/components/modules/workspace-ui';

type FormProps = { data: WarehouseWorkspaceData; requestId: string; actorName: string };
const normalized = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
const quantityInput = { type: 'number', min: '0.0001', step: '0.0001', inputMode: 'decimal' as const, required: true, className: inputClass };

function TransactionFields({ actorName, referenceLabel }: { actorName: string; referenceLabel: string }) {
  return <>
    <Field label={referenceLabel}><input className={inputClass} name="referenceNo" required maxLength={100} placeholder="Nomor bukti / referensi transaksi" /></Field>
    <Field label="Nama penerima / penyerah"><input className={inputClass} name="recipient" required maxLength={120} defaultValue={actorName} /></Field>
    <div className="sm:col-span-2"><Field label="Catatan"><textarea className={inputClass} name="notes" maxLength={1000} rows={2} placeholder="Keterangan tambahan (opsional)" /></Field></div>
  </>;
}

function CreateItemForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(createWarehouseItem, idleState);
  return <form action={action} className="mt-4 space-y-3">
    <fieldset disabled={demo || pending} className="grid gap-3 sm:grid-cols-2">
      <Field label="Kode material / SKU"><input className={inputClass} name="code" required maxLength={80} placeholder="Sama dengan kode material pada BoQ" /></Field>
      <Field label="Nama / deskripsi material"><input className={inputClass} name="description" required maxLength={300} placeholder="Contoh: Kabel power CU 240 mm²" /></Field>
      <Field label="Satuan"><input className={inputClass} name="unit" required maxLength={32} placeholder="PCS, UNIT, M, ROLL" /></Field>
      <Field label="Lokasi / rak gudang"><input className={inputClass} name="location" maxLength={120} placeholder="Contoh: Gudang utama · Rak A1" /></Field>
      <Field label="Batas stok minimum"><input className={inputClass} name="minQty" type="number" min="0" step="0.0001" defaultValue="0" required /></Field>
      <p className="self-center text-xs leading-5 text-slate-500">Material baru dimulai dengan saldo 0. Masukkan saldo awal melalui Barang masuk agar riwayat stok tercatat.</p>
      <button className={`${buttonClass} justify-self-start`}>{pending ? 'Menyimpan…' : 'Tambah material gudang'}</button>
    </fieldset>
    <MutationFeedback state={state} />
  </form>;
}

function ReceiveForm({ data, requestId, actorName }: FormProps) {
  const [state, action, pending] = useActionState(receiveWarehouseStock, idleState);
  const [itemId, setItemId] = useState('');
  const item = data.items.find(row => row.id === itemId);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="requestId" value={requestId} />
    <fieldset disabled={data.demoMode || pending || !data.items.length} className="grid gap-3 sm:grid-cols-2">
      <Field label="Material gudang"><select className={inputClass} name="warehouseItemId" value={itemId} required onChange={event => setItemId(event.target.value)}>
        <option value="">Pilih material gudang</option>{data.items.map(row => <option key={row.id} value={row.id}>{row.code} — {row.description} · {row.quantity} {row.unit}</option>)}
      </select></Field>
      <Field label={`Jumlah masuk${item ? ` (${item.unit})` : ''}`}><input {...quantityInput} name="quantity" defaultValue="1" /></Field>
      <TransactionFields actorName={actorName} referenceLabel="Nomor penerimaan / saldo awal" />
      {item && <p className="text-sm text-slate-600 sm:col-span-2">Stok saat ini: <strong>{item.quantity} {item.unit}</strong> · {item.location || 'Lokasi belum diisi'}</p>}
      <button className={`${buttonClass} justify-self-start`} disabled={!item}>{pending ? 'Menyimpan…' : 'Konfirmasi barang masuk'}</button>
    </fieldset>
    {!data.items.length && <p className="text-sm text-slate-500">Tambahkan material gudang terlebih dahulu.</p>}
    <MutationFeedback state={state} />
  </form>;
}

function IssueForm({ data, requestId, actorName }: FormProps) {
  const [state, action, pending] = useActionState(issueWarehouseStock, idleState);
  const [projectId, setProjectId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const projects = useMemo(() => [...new Map(data.materials.map(material => [material.projectId, material.projectLabel])).entries()], [data.materials]);
  const materials = data.materials.filter(material => material.projectId === projectId && material.remainingQty !== '0');
  const material = materials.find(row => row.id === materialId);
  const item = material && data.items.find(row => row.normalizedCode === material.normalizedCode && normalized(row.unit) === normalized(material.unit));
  const canIssue = Boolean(material && item && item.quantity !== '0');
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="warehouseItemId" value={item?.id ?? ''} />
    <fieldset disabled={data.demoMode || pending} className="grid gap-3 sm:grid-cols-2">
      <Field label="Proyek penerima"><select className={inputClass} required value={projectId} onChange={event => { setProjectId(event.target.value); setMaterialId(''); }}>
        <option value="">Pilih proyek dengan BoQ approved</option>{projects.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select></Field>
      <Field label="Item material BoQ"><select className={inputClass} name="materialId" value={material?.id ?? ''} required disabled={!projectId} onChange={event => setMaterialId(event.target.value)}>
        <option value="">Pilih material yang masih dibutuhkan</option>{materials.map(row => <option key={row.id} value={row.id}>{row.itemNo} · {row.code} — {row.description} · sisa {row.remainingQty} {row.unit}</option>)}
      </select></Field>
      {material && <div className="grid gap-3 rounded border border-teal-200 bg-teal-50 p-4 text-sm sm:col-span-2 sm:grid-cols-4">
        <p><span className="block text-xs text-slate-500">Kebutuhan BoQ v{material.boqVersion}</span><strong>{material.requiredQty} {material.unit}</strong></p>
        <p><span className="block text-xs text-slate-500">Sudah diterima proyek</span><strong>{material.receivedQty} {material.unit}</strong></p>
        <p><span className="block text-xs text-slate-500">Sisa kebutuhan</span><strong>{material.remainingQty} {material.unit}</strong></p>
        <p><span className="block text-xs text-slate-500">Tersedia di gudang</span><strong>{item ? `${item.quantity} ${item.unit}` : 'Kode / satuan belum cocok'}</strong></p>
      </div>}
      {material && !item && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">Belum ada material gudang dengan kode dan satuan yang sama. Tambahkan SKU yang sesuai terlebih dahulu; satuan tidak dikonversi otomatis.</p>}
      {item?.quantity === '0' && <p className="text-sm text-red-700 sm:col-span-2">Stok gudang kosong. Catat barang masuk sebelum melakukan pengambilan.</p>}
      <Field label={`Jumlah diambil${material ? ` (${material.unit})` : ''}`}><input {...quantityInput} name="quantity" max={material?.remainingQty} defaultValue="1" disabled={!canIssue} /></Field>
      <p className="self-center text-xs leading-5 text-slate-500">Jumlah dibatasi stok tersedia dan sisa kebutuhan BoQ. Konfirmasi mengurangi stok gudang dan menambah material diterima proyek.</p>
      <TransactionFields actorName={actorName} referenceLabel="Nomor bon pengambilan" />
      <button disabled={!canIssue} className={`${buttonClass} justify-self-start`}>{pending ? 'Menyimpan…' : 'Konfirmasi pengambilan'}</button>
    </fieldset>
    {!data.materials.length && <p className="text-sm text-slate-500">Belum ada material aktif dari BoQ approved. <Link href="/boq" className="text-teal-800 underline">Periksa BoQ proyek</Link>.</p>}
    {projectId && !materials.length && <p className="text-sm text-slate-500">Kebutuhan material proyek ini sudah terpenuhi.</p>}
    <MutationFeedback state={state} />
  </form>;
}

function ReturnForm({ data, requestId, actorName }: FormProps) {
  const [state, action, pending] = useActionState(returnWarehouseStock, idleState);
  const [issueId, setIssueId] = useState('');
  const issue = data.returnableIssues.find(row => row.id === issueId);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="requestId" value={requestId} />
    <fieldset disabled={data.demoMode || pending || !data.returnableIssues.length} className="grid gap-3 sm:grid-cols-2">
      <Field label="Pengambilan asal"><select className={inputClass} name="issueId" value={issueId} required onChange={event => setIssueId(event.target.value)}>
        <option value="">Pilih bon pengambilan yang diretur</option>{data.returnableIssues.map(row => <option value={row.id} key={row.id}>{row.referenceNo} · {row.itemCode} · {row.projectLabel} · maks. {row.returnableQty} {row.unit}</option>)}
      </select></Field>
      <Field label={`Jumlah retur${issue ? ` (${issue.unit})` : ''}`}><input {...quantityInput} name="quantity" max={issue?.returnableQty} defaultValue="1" disabled={!issue} /></Field>
      {issue && <p className="rounded border bg-slate-50 p-3 text-sm sm:col-span-2">Diambil: {issue.issuedQty} {issue.unit} · Sudah diretur: {issue.returnedQty} {issue.unit} · Dapat diretur saat ini: <strong>{issue.returnableQty} {issue.unit}</strong>. Material yang sudah terpasang tidak dapat diretur.</p>}
      <TransactionFields actorName={actorName} referenceLabel="Nomor bukti retur" />
      <button disabled={!issue} className={`${buttonClass} justify-self-start`}>{pending ? 'Menyimpan…' : 'Konfirmasi retur ke gudang'}</button>
    </fieldset>
    {!data.returnableIssues.length && <p className="text-sm text-slate-500">Tidak ada pengambilan yang dapat diretur pada hasil pencarian ini.</p>}
    <MutationFeedback state={state} />
  </form>;
}

const movementLabels: Record<string, string> = { RECEIPT: 'Barang masuk', ISSUE: 'Pengambilan proyek', RETURN: 'Retur ke gudang' };

export function WarehouseWorkspace({ data, requestId, actorName, receiveRequestId, issueRequestId, returnRequestId }: FormProps & { receiveRequestId: string; issueRequestId: string; returnRequestId: string }) {
  const [search, setSearch] = useState('');
  const visibleItems = data.items.filter(item => normalized(`${item.code} ${item.description} ${item.location}`).includes(normalized(search)));
  return <div className="mx-auto max-w-[1800px] space-y-5 p-5 md:p-7">
    <section className={panelClass}>
      <p className="section-kicker text-[#d85832]!">Inventory control</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">Stok Gudang</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-500">Kendalikan persediaan gudang dan pengambilan berdasarkan BoQ proyek. Stok berkurang saat pengambilan dikonfirmasi, lalu otomatis tercatat sebagai material diterima proyek. Persetujuan BoQ saja belum mengurangi stok.</p>
      {data.demoMode && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Mode demo hanya baca. Hubungkan database untuk mencatat persediaan dan transaksi gudang.</p>}
    </section>
    <Metrics items={[{ label: 'Material / SKU', value: data.metrics.items }, { label: 'Stok ≤ minimum', value: data.metrics.lowStock }, { label: 'Stok kosong', value: data.metrics.emptyStock }, { label: 'Transaksi tercatat', value: data.metrics.movements }]} />

    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-kicker">Current balance</p><h3 className="mt-1 flex items-center gap-2 text-xl font-semibold"><Boxes className="size-5 text-teal-700" /> Persediaan material</h3></div>
        <label className="flex w-full max-w-md items-center gap-2 rounded border px-3"><Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Cari material gudang" className="w-full py-2 text-sm outline-none" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari kode, nama, atau rak gudang" /></label>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Kode material', 'Deskripsi', 'Lokasi / rak', 'Satuan', 'Stok tersedia', 'Minimum', 'Status'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visibleItems.map(item => <tr className="border-b align-top" key={item.id}>
        <td className="p-3 font-mono font-semibold">{item.code}</td><td className="max-w-sm break-words p-3">{item.description}</td><td className="p-3">{item.location || '—'}</td><td className="p-3">{item.unit}</td><td className="p-3 font-mono text-base font-semibold">{item.quantity}</td><td className="p-3 font-mono">{item.minQty}</td><td className="p-3"><span className={`inline-block rounded px-2 py-1 text-xs ${item.lowStock ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>{item.quantity === '0' ? 'Kosong' : item.lowStock ? 'Perlu restock' : 'Tersedia'}</span></td>
      </tr>)}</tbody></table>{!visibleItems.length && <p className="py-6 text-center text-sm text-slate-500">{data.items.length ? 'Tidak ada material sesuai pencarian.' : 'Belum ada material gudang. Tambahkan material, lalu catat saldo awal melalui Barang masuk.'}</p>}</div>
    </section>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <details className={panelClass}><summary className="cursor-pointer text-lg font-semibold">+ Tambah material gudang</summary><CreateItemForm key={`item-${requestId}`} demo={data.demoMode} /></details>
      <details className={panelClass}><summary className="cursor-pointer text-lg font-semibold"><ArrowDownToLine className="mr-2 inline size-5 text-teal-700" /> Barang masuk / saldo awal</summary><ReceiveForm key={`receive-${requestId}`} data={data} requestId={receiveRequestId} actorName={actorName} /></details>
    </div>
    <section className={panelClass}>
      <p className="section-kicker">BoQ allocation</p><h3 className="mt-1 flex items-center gap-2 text-xl font-semibold"><ArrowUpFromLine className="size-5 text-orange-600" /> Pengambilan material untuk proyek</h3>
      <IssueForm key={`issue-${requestId}`} data={data} requestId={issueRequestId} actorName={actorName} />
    </section>
    <details className={panelClass}>
      <summary className="cursor-pointer text-lg font-semibold"><RotateCcw className="mr-2 inline size-5 text-teal-700" /> Retur material proyek ke gudang</summary>
      <form method="get" action="/warehouse" className="mt-4 flex flex-wrap items-end gap-2"><div className="w-full max-w-lg"><Field label="Cari bon lama untuk retur"><input className={inputClass} name="returnSearch" defaultValue={data.returnSearch} maxLength={100} placeholder="Nomor bon, kode proyek, nama proyek, atau kode material" /></Field></div><button className={buttonClass}>Cari pengambilan</button>{data.returnSearch && <Link className="p-2 text-sm text-teal-800 underline" href="/warehouse">Hapus pencarian</Link>}</form>
      <p className="mt-2 text-xs text-slate-500">Menampilkan pengambilan yang masih dapat diretur dari 200 transaksi terakhir sesuai pencarian. Cari nomor bon atau proyek untuk menemukan transaksi lama.</p>
      <ReturnForm key={`return-${requestId}`} data={data} requestId={returnRequestId} actorName={actorName} />
    </details>
    <section className={panelClass}>
      <p className="section-kicker">Stock movement ledger</p><h3 className="mt-1 flex items-center gap-2 text-xl font-semibold"><ArrowRightLeft className="size-5 text-teal-700" /> Riwayat transaksi gudang</h3><p className="mt-2 text-xs text-slate-500">100 transaksi terakhir. Saldo setelah transaksi berlaku untuk SKU terkait, sesuai urutan pencatatan.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-y bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Waktu / transaksi', 'Material', 'Jumlah', 'Saldo sesudah', 'Proyek / BoQ', 'Referensi / penerima', 'Dicatat oleh'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.movements.map(row => <tr key={row.id} className="border-b align-top">
        <td className="p-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${row.type === 'ISSUE' ? 'bg-orange-50 text-orange-800' : 'bg-teal-50 text-teal-800'}`}>{movementLabels[row.type] ?? row.type}</span><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(row.createdAt))} WIB</p></td>
        <td className="max-w-xs break-words p-3"><strong className="font-mono">{row.itemCode}</strong><p className="mt-1 text-xs text-slate-500">{row.description}</p></td><td className="whitespace-nowrap p-3 font-mono">{row.type === 'ISSUE' ? '−' : '+'}{row.quantity} {row.unit}</td><td className="whitespace-nowrap p-3 font-mono">{row.balanceAfter} {row.unit}</td><td className="max-w-xs break-words p-3">{row.projectLabel ?? 'Gudang'}{row.boqLabel && <p className="mt-1 text-xs text-slate-500">{row.boqLabel}</p>}</td><td className="max-w-xs break-words p-3"><strong>{row.referenceNo}</strong><p>{row.recipient}</p>{row.notes && <p className="mt-1 text-xs text-slate-500">{row.notes}</p>}</td><td className="p-3">{row.actor}</td>
      </tr>)}</tbody></table>{!data.movements.length && <p className="py-6 text-center text-sm text-slate-500">Belum ada transaksi gudang.</p>}</div>
    </section>
  </div>;
}
