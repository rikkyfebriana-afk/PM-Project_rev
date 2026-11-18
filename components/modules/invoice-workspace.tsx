'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import {
  recordInvoicePayment,
  saveInvoice,
  voidInvoice,
  voidInvoicePayment,
} from '@/app/actions/invoices';
import { exactPoMoney } from '@/lib/finance/po-summary';
import type { InvoiceData } from '@/lib/invoices/queries';
import {
  invoiceStatusLabels,
  isInvoiceStatus,
  type InvoiceStatus,
} from '@/lib/invoices/summary';
import { idleState } from '@/lib/operations/validation';
import {
  buttonClass,
  Field,
  inputClass,
  Metrics,
  MutationFeedback,
  panelClass,
  WorkspaceIntro,
} from './workspace-ui';

type Invoice = InvoiceData['invoices'][number];
type Payment = Invoice['payments'][number];

const invoiceStatusStyles: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-sky-50 text-sky-800',
  PARTIAL: 'bg-amber-50 text-amber-800',
  PAID: 'bg-teal-50 text-teal-800',
  OVERDUE: 'bg-red-50 text-red-800',
  VOID: 'bg-slate-100 text-slate-700',
};

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const date = (value: string) =>
  value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : '—';
const columnClass = 'px-4 py-3';
const moneyClass = `${columnClass} whitespace-nowrap text-right font-mono tabular-nums`;
const disclosureClass = 'border border-slate-200 bg-white p-4';
const secondaryButton =
  'rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#17364a] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const dangerButton =
  'rounded border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-40';

function AmountInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <input
      name="amount"
      inputMode="decimal"
      pattern="[0-9]{1,16}(\.[0-9]{1,2})?"
      maxLength={19}
      title="Masukkan nilai tanpa pemisah ribuan. Gunakan titik untuk desimal."
      placeholder="1500000.00"
      required
      defaultValue={defaultValue}
      className={inputClass}
    />
  );
}

function InvoiceForm({
  invoice,
  projects,
  today,
}: {
  invoice?: Invoice;
  projects: InvoiceData['projects'];
  today: string;
}) {
  const [state, action, pending] = useActionState(saveInvoice, idleState);
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today);

  return (
    <form action={action} className="mt-4 space-y-4">
      {invoice && (
        <>
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input type="hidden" name="updatedAt" value={invoice.updatedAt} />
          <input type="hidden" name="projectId" value={invoice.projectId} />
        </>
      )}
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
        {!invoice && (
          <div className="md:col-span-2">
            <Field label="PO Customer / Proyek selesai">
              <select
                name="projectId"
                className={inputClass}
                required
                defaultValue=""
              >
                <option value="">Pilih PO dari proyek yang sudah selesai</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.customerPoNumber} · {p.code} · {p.name} ·{' '}
                    {p.clientName || 'Customer belum diisi'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Nomor invoice">
          <input
            name="number"
            className={inputClass}
            maxLength={100}
            required
            defaultValue={invoice?.number}
          />
        </Field>
        <Field label="Nilai total invoice (IDR)">
          <AmountInput defaultValue={invoice?.amount} />
          <span className="font-normal">
            Gunakan nominal akhir pada invoice, termasuk PPN jika tercantum.
          </span>
        </Field>
        <Field label="Tanggal invoice">
          <input
            type="date"
            name="issueDate"
            className={inputClass}
            required
            value={issueDate}
            max={today}
            onChange={(event) => setIssueDate(event.target.value)}
          />
        </Field>
        <Field label="Tanggal jatuh tempo">
          <input
            type="date"
            name="dueDate"
            className={inputClass}
            min={issueDate || undefined}
            required
            defaultValue={invoice?.dueDate}
          />
        </Field>
        <Field label="Tanggal kirim ke customer">
          <input
            type="date"
            name="sentDate"
            className={inputClass}
            min={issueDate || undefined}
            max={today}
            defaultValue={invoice?.sentDate}
          />
          <span className="font-normal">
            Kosongkan tanggal kirim untuk menyimpan sebagai draf.
          </span>
        </Field>
        <Field label="Keterangan tagihan">
          <input
            name="description"
            className={inputClass}
            placeholder="Contoh: Tagihan termin 1"
            minLength={3}
            maxLength={240}
            required
            defaultValue={invoice?.description}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Catatan">
            <textarea
              name="notes"
              className={inputClass}
              rows={2}
              maxLength={1000}
              defaultValue={invoice?.notes}
            />
          </Field>
        </div>
      </fieldset>
      <button className={buttonClass} disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan invoice'}
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}

function PaymentForm({ invoice, today }: { invoice: Invoice; today: string }) {
  const [state, action, pending] = useActionState(
    recordInvoicePayment,
    idleState,
  );

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="requestId" value={invoice.paymentRequestId} />
      <p className="text-xs text-slate-600">
        Sisa tagihan {exactPoMoney(invoice.balance)}
      </p>
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
        <Field label="Jumlah pembayaran (IDR)">
          <AmountInput />
        </Field>
        <Field label="Tanggal pembayaran">
          <input
            name="paidDate"
            type="date"
            min={invoice.issueDate}
            max={today}
            defaultValue={today}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Nomor referensi pembayaran">
          <input
            name="reference"
            placeholder="Referensi transfer atau kuitansi"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Catatan pembayaran">
          <input name="notes" maxLength={1000} className={inputClass} />
        </Field>
      </fieldset>
      <button
        className={buttonClass}
        disabled={pending || state.status === 'success'}
      >
        {pending ? 'Mencatat…' : 'Simpan pembayaran'}
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}

function VoidForm({
  invoice,
  payment,
}: {
  invoice: Invoice;
  payment?: Payment;
}) {
  const [state, action, pending] = useActionState(
    payment ? voidInvoicePayment : voidInvoice,
    idleState,
  );
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      {payment ? (
        <input type="hidden" name="paymentId" value={payment.id} />
      ) : (
        <input type="hidden" name="updatedAt" value={invoice.updatedAt} />
      )}
      <Field label="Alasan pembatalan">
        <input
          name="reason"
          required
          minLength={5}
          maxLength={500}
          className={inputClass}
          disabled={pending}
        />
      </Field>
      <button className={dangerButton} disabled={pending}>
        {pending
          ? 'Membatalkan…'
          : payment
            ? 'Konfirmasi pembatalan pembayaran'
            : 'Konfirmasi pembatalan invoice'}
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}

function InvoiceStatusBadge({
  invoice,
  today,
}: {
  invoice: Invoice;
  today: string;
}) {
  const status = invoice.status;
  const daysLate =
    (Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${invoice.dueDate}T00:00:00Z`)) /
    86_400_000;

  return (
    <>
      <span
        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${invoiceStatusStyles[status]}`}
      >
        {invoiceStatusLabels[status]}
      </span>
      {invoice.status === 'OVERDUE' && (
        <p className="mt-1 text-xs text-red-800">
          {daysLate} hari
          {Number(invoice.paidAmount) > 0 && ' · Dibayar sebagian'}
        </p>
      )}
    </>
  );
}

function InvoiceDetail({
  invoice,
  data,
}: {
  invoice: Invoice;
  data: InvoiceData;
}) {
  const canEdit = !data.demoMode && invoice.status !== 'VOID';
  const hasPayment = Number(invoice.paidAmount) > 0;
  const canRecordPayment =
    canEdit && invoice.sentDate && Number(invoice.balance) > 0;
  const detailFields = [
    ['Tanggal terbit', date(invoice.issueDate)],
    ['Tanggal kirim', date(invoice.sentDate)],
    ['Tanggal jatuh tempo', date(invoice.dueDate)],
    ['Nilai invoice', exactPoMoney(invoice.amount)],
    ['Terbayar', exactPoMoney(invoice.paidAmount)],
    [
      'Sisa tagihan',
      invoice.status === 'VOID' ? '—' : exactPoMoney(invoice.balance),
    ],
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-[#17364a]">
              Invoice {invoice.number}
            </h4>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">
              {invoice.project.name}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {invoice.project.customerPoNumber} ·{' '}
              {invoice.project.clientName || 'Customer belum diisi'} ·{' '}
              {invoice.project.code}
            </p>
          </div>
          <div>
            <InvoiceStatusBadge invoice={invoice} today={data.today} />
          </div>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">
          {invoice.description}
        </p>
        {invoice.notes && (
          <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">
            {invoice.notes}
          </p>
        )}
        {invoice.voidedAt && (
          <p className="mt-2 text-xs text-red-800">
            Dibatalkan pada {date(invoice.voidedAt)} · {invoice.voidReason}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 border-y border-slate-200 py-4 sm:grid-cols-3 lg:grid-cols-6">
        {detailFields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-slate-600">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {canEdit && (
        <details className={disclosureClass}>
          <summary className="cursor-pointer font-semibold">
            Ubah invoice
          </summary>
          <InvoiceForm
            key={invoice.updatedAt}
            invoice={invoice}
            projects={data.projects}
            today={data.today}
          />
        </details>
      )}
      {canRecordPayment && (
        <details className={disclosureClass}>
          <summary className="cursor-pointer font-semibold">
            Catat pembayaran
          </summary>
          <PaymentForm
            key={invoice.paymentRequestId}
            invoice={invoice}
            today={data.today}
          />
        </details>
      )}

      <section
        className={disclosureClass}
        aria-labelledby={`payment-history-${invoice.id}`}
      >
        <h5 id={`payment-history-${invoice.id}`} className="font-semibold">
          Riwayat pembayaran
        </h5>
        {!invoice.payments.length && (
          <p className="mt-2 text-xs text-slate-500">
            Belum ada pembayaran tercatat.
          </p>
        )}
        {invoice.payments.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-200">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="py-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="break-words font-semibold">
                      {payment.reference || 'Tanpa referensi'}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {date(payment.paidDate)} · Dicatat oleh {payment.actor}
                    </p>
                  </div>
                  <p
                    className={`whitespace-nowrap font-mono font-semibold ${payment.voidedAt ? 'text-slate-500 line-through' : 'text-[#17364a]'}`}
                  >
                    {exactPoMoney(payment.amount)}
                  </p>
                </div>
                {payment.notes && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">
                    {payment.notes}
                  </p>
                )}
                {payment.voidedAt ? (
                  <p className="mt-2 text-xs text-red-800">
                    Dibatalkan pada {date(payment.voidedAt)} ·{' '}
                    {payment.voidReason}
                  </p>
                ) : (
                  canEdit && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-red-800">
                        Batalkan pembayaran
                      </summary>
                      <VoidForm invoice={invoice} payment={payment} />
                    </details>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && !hasPayment && (
        <details className={disclosureClass}>
          <summary className="cursor-pointer text-sm font-semibold text-red-800">
            Batalkan invoice
          </summary>
          <VoidForm invoice={invoice} />
        </details>
      )}
    </div>
  );
}

export function InvoiceWorkspace({
  data,
  initialStatus,
}: {
  data: InvoiceData;
  initialStatus?: InvoiceStatus;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>(initialStatus ?? '');
  const [projectId, setProjectId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detailButtons = useRef(new Map<string, HTMLButtonElement>());
  const projectOptions = new Map(
    data.projects.map((project) => [project.id, project]),
  );
  for (const { project } of data.invoices) {
    if (!projectOptions.has(project.id))
      projectOptions.set(project.id, project);
  }
  const needle = search.trim().toLowerCase();
  const invoices = data.invoices.filter(
    (invoice) =>
      (!status || status === invoice.status) &&
      (!projectId || projectId === invoice.projectId) &&
      `${invoice.number} ${invoice.project.customerPoNumber} ${invoice.project.clientName} ${invoice.project.code} ${invoice.project.name}`
        .toLowerCase()
        .includes(needle),
  );

  function openDetail(id: string) {
    setExpandedId(id);
    requestAnimationFrame(() => detailRef.current?.focus());
  }

  function closeDetail(id: string) {
    setExpandedId(null);
    detailButtons.current.get(id)?.focus();
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Status Invoice"
        description="Buat invoice setelah proyek berstatus Closed dan PO Customer berstatus Selesai. Pantau pengiriman tagihan, jatuh tempo, pembayaran, dan sisa tagihan per proyek."
        demo={data.demoMode}
      />
      <Metrics
        items={[
          {
            label: 'Total invoice terkirim',
            value: exactPoMoney(data.totals.billed),
          },
          {
            label: 'Pembayaran diterima',
            value: exactPoMoney(data.totals.paid),
          },
          { label: 'Sisa tagihan', value: exactPoMoney(data.totals.balance) },
          {
            label: 'Sisa lewat jatuh tempo',
            value: exactPoMoney(data.totals.overdue),
          },
        ]}
      />
      {!data.demoMode &&
        (data.projects.length ? (
          <details className={panelClass}>
            <summary className="cursor-pointer font-semibold text-[#17364a]">
              + Tambah invoice
            </summary>
            <InvoiceForm projects={data.projects} today={data.today} />
          </details>
        ) : (
          <section className={panelClass}>
            <p className="text-sm text-slate-600">
              Invoice baru tersedia setelah proyek berstatus Closed dan PO
              Customer berstatus Selesai serta memiliki nomor PO.
            </p>
            <Link href="/customer-po" className={`${buttonClass} mt-3`}>
              Buka PO Customer
            </Link>
          </section>
        ))}
      <section
        className="min-w-0 border border-slate-200 bg-white"
        aria-labelledby="invoice-list-heading"
      >
        <div className="border-b border-slate-200 p-5 md:px-6">
          <h3 id="invoice-list-heading" className="font-semibold">
            Daftar invoice customer
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
            <Field label="Cari invoice, PO, customer, atau proyek">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nomor invoice atau nama customer"
                className={inputClass}
              />
            </Field>
            <Field label="Filter PO">
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={inputClass}
              >
                <option value="">Semua PO</option>
                {[...projectOptions.values()].map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.customerPoNumber || 'PO belum tercatat'} ·{' '}
                    {project.code} · {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Filter status invoice">
              <select
                value={status}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatus(isInvoiceStatus(value) ? value : '');
                }}
                className={inputClass}
              >
                <option value="">Semua status</option>
                {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-4 text-xs text-slate-500" role="status">
            Menampilkan {invoices.length} dari {data.invoices.length} invoice.
          </p>
        </div>
        {invoices.length ? (
          <div
            role="region"
            aria-label="Tabel status invoice customer"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Daftar tagihan customer dan status pembayaran
              </caption>
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th scope="col" className={columnClass}>
                    Nomor invoice
                  </th>
                  <th scope="col" className={columnClass}>
                    PO / Proyek / Customer
                  </th>
                  <th scope="col" className={columnClass}>
                    Tanggal kirim
                  </th>
                  <th scope="col" className={columnClass}>
                    Jatuh tempo
                  </th>
                  <th scope="col" className={`${columnClass} text-right`}>
                    Nilai invoice
                  </th>
                  <th scope="col" className={`${columnClass} text-right`}>
                    Terbayar
                  </th>
                  <th scope="col" className={`${columnClass} text-right`}>
                    Sisa tagihan
                  </th>
                  <th scope="col" className={columnClass}>
                    Status
                  </th>
                  <th
                    scope="col"
                    className={`sticky right-0 bg-slate-50 ${columnClass}`}
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const expanded = expandedId === invoice.id;
                  return (
                    <tr
                      key={invoice.id}
                      data-invoice-id={invoice.id}
                      data-invoice-status={invoice.status}
                      className={`border-t border-slate-200 align-top ${expanded ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                    >
                      <th
                        scope="row"
                        className={`max-w-[200px] font-semibold ${columnClass}`}
                      >
                        <span className="break-words text-[#17364a]">
                          {invoice.number}
                        </span>
                        <span className="mt-1 block whitespace-nowrap text-xs font-normal text-slate-500">
                          {date(invoice.issueDate)}
                        </span>
                      </th>
                      <td className={`min-w-40 max-w-[260px] ${columnClass}`}>
                        <p className="break-words font-medium">
                          {invoice.project.customerPoNumber || '—'}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-700">
                          {invoice.project.name}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-600">
                          {invoice.project.clientName || '—'} ·{' '}
                          {invoice.project.code}
                        </p>
                      </td>
                      <td className={`whitespace-nowrap ${columnClass}`}>
                        {date(invoice.sentDate)}
                      </td>
                      <td className={`whitespace-nowrap ${columnClass}`}>
                        {date(invoice.dueDate)}
                      </td>
                      <td className={moneyClass}>
                        {exactPoMoney(invoice.amount)}
                      </td>
                      <td className={moneyClass}>
                        {exactPoMoney(invoice.paidAmount)}
                      </td>
                      <td
                        className={`${moneyClass} font-semibold ${invoice.status === 'OVERDUE' ? 'text-red-800' : ''}`}
                      >
                        {invoice.status === 'VOID'
                          ? '—'
                          : exactPoMoney(invoice.balance)}
                      </td>
                      <td className={columnClass}>
                        <InvoiceStatusBadge
                          invoice={invoice}
                          today={data.today}
                        />
                      </td>
                      <td className={`sticky right-0 bg-white ${columnClass}`}>
                        <button
                          type="button"
                          ref={(node) => {
                            if (node)
                              detailButtons.current.set(invoice.id, node);
                            else detailButtons.current.delete(invoice.id);
                          }}
                          aria-expanded={expanded}
                          aria-controls={`invoice-detail-${invoice.id}`}
                          aria-label={`${expanded ? 'Tutup' : 'Lihat'} detail invoice ${invoice.number}`}
                          onClick={() =>
                            expanded
                              ? closeDetail(invoice.id)
                              : openDetail(invoice.id)
                          }
                          className={secondaryButton}
                        >
                          {expanded ? 'Tutup' : 'Detail'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">
            {data.invoices.length
              ? 'Tidak ada invoice yang cocok dengan filter.'
              : 'Belum ada invoice tercatat.'}
          </p>
        )}
      </section>
      {invoices.map((invoice) => (
        <article
          key={invoice.id}
          id={`invoice-detail-${invoice.id}`}
          ref={expandedId === invoice.id ? detailRef : undefined}
          aria-label={`Detail invoice ${invoice.number}`}
          hidden={expandedId !== invoice.id}
          tabIndex={-1}
          className={`${panelClass} scroll-mt-24 focus-visible:outline-2 focus-visible:outline-teal-700`}
        >
          <button
            type="button"
            className={`${secondaryButton} mb-4`}
            onClick={() => closeDetail(invoice.id)}
          >
            Kembali ke daftar invoice
          </button>
          <InvoiceDetail invoice={invoice} data={data} />
        </article>
      ))}
    </main>
  );
}
