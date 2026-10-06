'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { FileText, Search } from 'lucide-react';
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
  const filtered = data.projects.filter(
    (p) =>
      (!status ||
        (status === 'MISSING'
          ? !p.customerPoNumber
          : !!p.customerPoNumber && p.customerPoStatus === status)) &&
      `${p.code} ${p.name} ${p.clientName} ${p.customerPoNumber}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="PO Customer"
        description="Purchase Order masuk dari customer ke PT. Arsko Sukses Bersama. Satu proyek, satu PO — lengkap dengan dokumen dan riwayat pembaruan."
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nomor PO / nama customer / proyek"
            />
          </div>
        </Field>
        <Field label="Filter status PO">
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
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
      </section>
      <p className="text-xs text-slate-500">
        {filtered.length} proyek ditampilkan. Nilai proyek lama tetap digunakan;
        lengkapi PO tanpa membuat proyek baru.{' '}
        {data.canEdit
          ? ''
          : 'Anda memiliki akses baca sesuai penugasan proyek.'}
      </p>
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
      {filtered.map((p) => (
        <article key={p.id} className={panelClass}>
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
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${p.customerPoNumber ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}
            >
              {p.customerPoNumber
                ? poStatusLabels[p.customerPoStatus]
                : 'Belum dilengkapi'}
            </span>
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
