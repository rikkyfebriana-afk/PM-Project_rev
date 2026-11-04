'use client';
import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { ArrowLeft, FileText, LayoutGrid, List, Search } from 'lucide-react';
import { saveCustomerPo } from '@/app/actions/customer-po';
import type { CustomerPoData } from '@/lib/customer-po/queries';
import { poStatuses, poStatusLabels } from '@/lib/customer-po/validation';
import { idleState } from '@/lib/operations/validation';
import { DocumentUpload } from './document-upload';
import {
  WorkspaceIntro,
  Metrics,
  Field,
  inputClass,
  buttonClass,
  panelClass,
  MutationFeedback,
} from './workspace-ui';

type Po = CustomerPoData['projects'][number];
const money = (v: string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 2,
  }).format(Number(v));
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T00:00:00Z`))
    : '—';
function PoStatus({ p }: { p: Po }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    RECEIVED: 'bg-sky-50 text-sky-800',
    IN_PROGRESS: 'bg-amber-50 text-amber-800',
    COMPLETED: 'bg-teal-50 text-teal-800',
    CANCELLED: 'bg-red-50 text-red-800',
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${p.customerPoNumber ? colors[p.customerPoStatus] : 'bg-amber-50 text-amber-800'}`}
    >
      {p.customerPoNumber
        ? poStatusLabels[p.customerPoStatus]
        : 'Belum dilengkapi'}
    </span>
  );
}
function PoForm({ p, enabled }: { p: Po; enabled: boolean }) {
  const [poStatus, setPoStatus] = useState(p.customerPoStatus);
  const [state, action, pending] = useActionState(saveCustomerPo, idleState);
  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="projectId" value={p.id} />
      <input type="hidden" name="updatedAt" value={p.updatedAt} />
      <fieldset
        disabled={!enabled || pending}
        className="grid gap-4 md:grid-cols-2"
      >
        <Field label="Nomor PO customer">
          <input
            name="customerPoNumber"
            required
            maxLength={100}
            defaultValue={p.customerPoNumber}
            className={inputClass}
          />
        </Field>
        <Field label="Nama customer">
          <input
            name="clientName"
            required
            minLength={2}
            maxLength={160}
            defaultValue={p.clientName}
            className={inputClass}
          />
        </Field>
        <Field label="Tanggal PO">
          <input
            name="customerPoDate"
            type="date"
            required
            defaultValue={p.customerPoDate}
            className={inputClass}
          />
        </Field>
        <Field label="Target delivery PO">
          <input
            name="customerPoDelivery"
            type="date"
            defaultValue={p.customerPoDelivery}
            className={inputClass}
          />
        </Field>
        <Field label="Nilai PO sebelum PPN (IDR)">
          <input
            name="poValue"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={p.poValue}
            className={inputClass}
          />
        </Field>
        <Field label="Nominal PPN sesuai dokumen (IDR)">
          <input
            name="customerPoTax"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={p.customerPoTax}
            className={inputClass}
          />
        </Field>
        <Field label="Status PO">
          <select
            name="customerPoStatus"
            value={poStatus}
            onChange={(e) => setPoStatus(e.target.value)}
            className={inputClass}
          >
            {poStatuses.map((s) => (
              <option key={s} value={s}>
                {poStatusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deskripsi pekerjaan">
          <textarea
            name="customerPoDescription"
            required
            minLength={3}
            maxLength={2000}
            defaultValue={p.customerPoDescription}
            className={inputClass}
          />
        </Field>
        {poStatus === 'COMPLETED' ? (
          <Field label="Tanggal selesai PO">
            <input
              name="customerPoCompletedDate"
              type="date"
              required
              min={p.customerPoDate || undefined}
              defaultValue={p.customerPoCompletedDate}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Tanggal pekerjaan PO selesai, bukan tanggal pembayaran. Dipakai
              untuk grafik bulanan.
            </p>
          </Field>
        ) : (
          <input type="hidden" name="customerPoCompletedDate" value="" />
        )}
        <div className="md:col-span-2">
          <Field label="Catatan update">
            <textarea
              name="customerPoNotes"
              maxLength={4000}
              defaultValue={p.customerPoNotes}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>
      <p className="text-xs leading-5 text-slate-500">
        Nilai PO ini menggantikan nilai proyek yang sama, bukan menambahkannya.
        PPN tidak masuk perhitungan margin. Status PO tidak otomatis menutup
        atau membatalkan proyek.
      </p>
      <MutationFeedback state={state} />
      {enabled && (
        <button className={buttonClass} disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan PO Customer'}
        </button>
      )}
    </form>
  );
}
export function CustomerPoWorkspace({ data }: { data: CustomerPoData }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [registeredOnly, setRegisteredOnly] = useState(false);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRefs = useRef(new Map<string, HTMLElement>());
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const filtered = data.projects.filter(
    (p) =>
      (!registeredOnly || !!p.customerPoNumber) &&
      (!status ||
        (status === 'MISSING'
          ? !p.customerPoNumber
          : !!p.customerPoNumber && p.customerPoStatus === status)) &&
      `${p.code} ${p.name} ${p.clientName} ${p.customerPoNumber}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  function openDetail(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      const detail = detailRefs.current.get(id);
      detail?.focus({ preventScroll: true });
      detail?.scrollIntoView({ block: 'start' });
    });
  }
  function closeDetail(id: string) {
    setSelectedId(null);
    rowRefs.current.get(id)?.focus();
  }
  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="PO Customer"
        description="Daftar Purchase Order masuk dari customer ke PT. Arsko Sukses Bersama. Pantau nomor PO, customer, nilai, dan status, lalu buka detail untuk dokumen serta riwayat pembaruan."
        demo={data.demoMode}
      />
      <Metrics
        items={[
          { label: 'PO tercatat', value: data.totals.registered },
          { label: 'Belum dilengkapi', value: data.totals.missing },
          {
            label: 'Nilai PO proyek aktif (tanpa PPN)',
            value: money(data.totals.value),
          },
          { label: 'PPN proyek aktif', value: money(data.totals.tax) },
        ]}
      />
      <section className={`${panelClass} grid gap-4 md:grid-cols-[1fr_240px]`}>
        <Field label="Cari PO, customer, atau proyek">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedId(null);
              }}
              placeholder="Nomor PO / nama customer / proyek"
            />
          </div>
        </Field>
        <Field label="Filter status PO">
          <select
            className={inputClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              if (e.target.value === 'MISSING') setRegisteredOnly(false);
              setSelectedId(null);
            }}
          >
            <option value="">Semua status</option>
            <option value="MISSING">Belum dilengkapi</option>
            {poStatuses.map((s) => (
              <option key={s} value={s}>
                {poStatusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 md:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={registeredOnly}
              onChange={(e) => {
                setRegisteredOnly(e.target.checked);
                if (e.target.checked && status === 'MISSING') setStatus('');
                setSelectedId(null);
              }}
              className="h-4 w-4 accent-[#17364a]"
            />
            Hanya PO yang sudah tercatat
          </label>
          <div
            role="group"
            aria-label="Tampilan daftar PO"
            className="inline-flex rounded border border-slate-300 p-1"
          >
            {(
              [
                ['table', 'Tabel', List],
                ['cards', 'Kartu', LayoutGrid],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  setSelectedId(null);
                }}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${view === value ? 'bg-[#17364a] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"
        role="status"
      >
        <p>
          Menampilkan {filtered.length} dari {data.projects.length} proyek ·{' '}
          {filtered.filter((p) => p.customerPoNumber).length} PO tercatat.
        </p>
        <p>
          {data.canEdit
            ? 'Lengkapi PO pada proyek yang sama tanpa membuat proyek baru.'
            : 'Akses baca sesuai izin akun Anda.'}
        </p>
      </div>
      {!data.projects.length && (
        <section className={panelClass}>
          <h3 className="font-semibold">Belum ada proyek</h3>
          <p className="my-3 text-sm text-slate-500">
            Buat proyek terlebih dahulu, lalu lengkapi PO customer di sini.
          </p>
          <Link href="/projects" className={buttonClass}>
            Buka Projects
          </Link>
        </section>
      )}
      {!!data.projects.length && !filtered.length && (
        <p className={panelClass}>Tidak ada PO yang cocok dengan pencarian.</p>
      )}
      {!!filtered.length && (
        <section
          hidden={view !== 'table'}
          className="min-w-0 border border-slate-200 bg-white"
          aria-labelledby="po-list-heading"
        >
          <div className="border-b border-slate-200 p-5 md:px-6">
            <h3 id="po-list-heading" className="font-semibold">
              Daftar PO Customer
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Geser tabel ke samping untuk melihat seluruh kolom. Pilih Detail
              untuk membuka PO.
            </p>
          </div>
          <div
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-teal-700"
            role="region"
            aria-label="Tabel daftar PO Customer"
            tabIndex={0}
          >
            <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Daftar PO Customer beserta customer, proyek, tanggal, nilai
                rupiah, dan status PO
              </caption>
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  {[
                    'No.',
                    'Nomor / tanggal PO',
                    'Customer',
                    'Proyek',
                    'Target delivery',
                    'Nilai sebelum PPN',
                    'Total termasuk PPN',
                    'Status PO',
                    'Aksi',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={`border-b border-slate-200 px-4 py-4 font-semibold ${label.includes('Nilai') || label.includes('Total') ? 'text-right' : ''} ${label === 'Aksi' ? 'sticky right-0 bg-slate-50' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, index) => (
                  <tr
                    key={p.id}
                    className={`${selectedId === p.id ? 'bg-teal-50/60' : 'hover:bg-slate-50'} align-top`}
                  >
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <th
                      scope="row"
                      className="max-w-[200px] px-4 py-4 font-normal"
                    >
                      <p className="break-words font-semibold text-[#17364a]">
                        {p.customerPoNumber || 'Belum dilengkapi'}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                        {date(p.customerPoDate)}
                      </p>
                    </th>
                    <td className="min-w-[160px] max-w-[220px] break-words px-4 py-4">
                      {p.clientName || 'Customer belum diisi'}
                    </td>
                    <td className="min-w-[240px] max-w-[320px] px-4 py-4">
                      <p className="text-xs font-semibold text-[#d85832]">
                        {p.code}
                      </p>
                      <p className="mt-1 break-words leading-5">{p.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Status proyek: {p.projectStatus}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {date(p.customerPoDelivery)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-mono tabular-nums">
                      {money(p.poValue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <p className="font-mono font-semibold tabular-nums">
                        {money(p.total)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        PPN: {money(p.customerPoTax)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <PoStatus p={p} />
                    </td>
                    <td
                      className={`sticky right-0 px-4 py-4 ${selectedId === p.id ? 'bg-teal-50' : 'bg-white'}`}
                    >
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) rowRefs.current.set(p.id, node);
                          else rowRefs.current.delete(p.id);
                        }}
                        aria-label={`Detail PO ${p.customerPoNumber || p.code}`}
                        aria-expanded={selectedId === p.id}
                        aria-controls={`po-detail-${p.id}`}
                        onClick={() => openDetail(p.id)}
                        className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-[#17364a] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {filtered.map((p) => (
        <article
          key={p.id}
          id={`po-detail-${p.id}`}
          hidden={view === 'table' && selectedId !== p.id}
          ref={(node) => {
            if (node) detailRefs.current.set(p.id, node);
            else detailRefs.current.delete(p.id);
          }}
          tabIndex={-1}
          aria-label={`Detail PO ${p.customerPoNumber || p.code}`}
          className={`${panelClass} scroll-mt-24 focus-visible:outline-2 focus-visible:outline-teal-700`}
        >
          {view === 'table' && (
            <button
              type="button"
              onClick={() => closeDetail(p.id)}
              className="mb-5 inline-flex items-center gap-2 rounded text-sm font-semibold text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Kembali ke daftar PO
            </button>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-wider text-[#d85832]">
                {p.code} · {p.projectStatus}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {p.clientName || 'Customer belum diisi'}
              </p>
            </div>
            <PoStatus p={p} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Nomor PO', p.customerPoNumber || '—'],
              [
                'Tanggal / target delivery',
                `${p.customerPoDate || '—'} / ${p.customerPoDelivery || '—'}`,
              ],
              ['Nilai sebelum PPN', money(p.poValue)],
              ['Total termasuk PPN', money(p.total)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 break-words font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-5 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#17364a]">
              {data.canEdit ? 'Lengkapi / update PO' : 'Lihat detail PO'}
            </summary>
            <PoForm
              key={p.updatedAt}
              p={p}
              enabled={data.canEdit && !data.demoMode}
            />
          </details>
          <details className="mt-4 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Dokumen PO ({p.documents.length})
            </summary>
            <div className="mt-3 space-y-2">
              {p.documents.map((d) => (
                <a
                  key={d.id}
                  href={`/api/documents/${d.id}/download`}
                  className="flex items-center gap-2 text-sm text-teal-800 underline"
                >
                  <FileText size={16} />
                  {d.name} · {d.date}
                </a>
              ))}
              {!p.documents.length && (
                <p className="text-sm text-slate-500">Belum ada dokumen PO.</p>
              )}
            </div>
            {data.canEdit && !data.demoMode && (
              <DocumentUpload projectId={p.id} category="PURCHASE_ORDER" />
            )}
          </details>
          <details className="mt-4 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Riwayat update PO
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              10 perubahan terakhir; seluruh riwayat tetap disimpan.
            </p>
            {p.history.map((h) => (
              <div
                key={h.id}
                className="mt-3 border-l-2 border-teal-500 pl-3 text-sm"
              >
                <p className="font-semibold">
                  {h.action === 'CUSTOMER_PO_CREATED'
                    ? 'PO dicatat'
                    : 'PO diperbarui'}{' '}
                  · {h.actor}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(h.date).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                  })}{' '}
                  WIB
                </p>
                <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                  {h.detail}
                </p>
              </div>
            ))}
            {!p.history.length && (
              <p className="mt-3 text-sm text-slate-500">
                Belum ada pembaruan PO.
              </p>
            )}
          </details>
        </article>
      ))}
    </main>
  );
}
