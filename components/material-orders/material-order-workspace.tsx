'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  PackageCheck,
  Search,
  Truck,
} from 'lucide-react';
import {
  materialOrderStatuses,
  type MaterialOrderRow,
  type MaterialOrderStatusValue,
  type MaterialOrderWorkspaceData,
  type OrderStockRow,
} from '@/lib/material-orders/types';
import { idleState, type MutationState } from '@/lib/operations/validation';
import {
  Field,
  inputClass,
  Metrics,
  MutationFeedback,
  panelClass,
} from '@/components/modules/workspace-ui';
import {
  MaterialOrderForm,
  type OrderDialogSelection,
} from './material-order-form';
import { formatOrderQuantity } from './format-quantity';

const labels: Record<MaterialOrderStatusValue, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Sudah dipesan',
  PARTIAL: 'Diterima sebagian',
  RECEIVED: 'Diterima lengkap',
  CANCELLED: 'Dibatalkan',
};
const activeStatuses = new Set<MaterialOrderStatusValue>([
  'DRAFT',
  'ORDERED',
  'PARTIAL',
]);
const normalize = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('id-ID');
const secondaryButton =
  'inline-flex min-h-9 items-center justify-center rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#17364a] hover:border-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40';
function date(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: value.length === 10 ? 'UTC' : 'Asia/Jakarta',
  }).format(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value));
}
function Status({ value }: { value: MaterialOrderStatusValue }) {
  const tone = {
    DRAFT: 'bg-slate-100 text-slate-700',
    ORDERED: 'bg-blue-50 text-blue-800',
    PARTIAL: 'bg-amber-50 text-amber-800',
    RECEIVED: 'bg-teal-50 text-teal-800',
    CANCELLED: 'bg-red-50 text-red-800',
  }[value];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {labels[value]}
    </span>
  );
}

export function MaterialOrderWorkspace({
  data,
  actorName,
  createRequestId,
  receiveRequestId,
}: {
  data: MaterialOrderWorkspaceData;
  actorName: string;
  createRequestId: string;
  receiveRequestId: string;
}) {
  const [stockSearch, setStockSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selection, setSelection] = useState<OrderDialogSelection | null>(null);
  const [dialogRequestId, setDialogRequestId] = useState(createRequestId);
  const [feedback, setFeedback] = useState<MutationState>(idleState);
  const items = data.items.filter((item) =>
    normalize(`${item.code} ${item.description}`).includes(
      normalize(stockSearch),
    ),
  );
  const orders = data.orders.filter(
    (order) =>
      normalize(
        `${order.code} ${order.description} ${order.supplier} ${order.referenceNo}`,
      ).includes(normalize(orderSearch)) &&
      (status === 'ALL' ||
        (status === 'OPEN'
          ? activeStatuses.has(order.status)
          : order.status === status)),
  );
  function open(next: OrderDialogSelection) {
    // Generate only in the user event: a fresh operation has its own retry token.
    setDialogRequestId(
      globalThis.crypto?.randomUUID?.() ??
        (next.mode === 'receive' ? receiveRequestId : createRequestId),
    );
    setFeedback(idleState);
    setSelection(next);
  }
  function showOpenOrder(item: OrderStockRow) {
    // Orders keep their original material code when the warehouse master is renamed.
    const existingOrder = data.orders.find(
      (order) => order.id === item.openOrderId,
    );
    setOrderSearch(existingOrder?.code ?? item.code);
    setStatus('OPEN');
    document
      .getElementById('material-order-history')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function actions(order: MaterialOrderRow) {
    const confirmReady = Boolean(
      order.supplier.trim() && order.referenceNo.trim(),
    );
    return (
      <div className="flex max-w-xs flex-wrap gap-2">
        {order.status === 'DRAFT' && (
          <>
            <button
              className={secondaryButton}
              type="button"
              disabled={data.demoMode}
              aria-label={`Edit draft ${order.code}`}
              onClick={() => open({ mode: 'edit', order })}
            >
              Edit draft
            </button>
            <button
              className={secondaryButton}
              type="button"
              disabled={data.demoMode || !confirmReady}
              aria-label={`Tandai sudah dipesan ${order.code}`}
              onClick={() => open({ mode: 'confirm', order })}
            >
              Tandai sudah dipesan
            </button>
            {!confirmReady && (
              <p className="w-full text-xs leading-5 text-slate-500">
                Lengkapi supplier dan referensi melalui Edit draft.
              </p>
            )}
          </>
        )}
        {(order.status === 'ORDERED' || order.status === 'PARTIAL') && (
          <button
            className={`${secondaryButton} border-teal-600 text-teal-800`}
            type="button"
            disabled={data.demoMode}
            aria-label={`Terima material ${order.code}`}
            onClick={() => open({ mode: 'receive', order })}
          >
            Terima material
          </button>
        )}
        {activeStatuses.has(order.status) && (
          <button
            className={`${secondaryButton} text-red-700`}
            type="button"
            disabled={data.demoMode}
            aria-label={`Batalkan sisa order ${order.code}`}
            onClick={() => open({ mode: 'cancel', order })}
          >
            Batalkan sisa
          </button>
        )}
        {!activeStatuses.has(order.status) && (
          <span className="text-xs text-slate-500">Order ditutup</span>
        )}
      </div>
    );
  }
  return (
    <main className="mx-auto max-w-[1800px] space-y-6 p-4 md:p-7">
      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="section-kicker text-[#d85832]!">
              Procurement control
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Material Status Order
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tindak lanjuti stok gudang yang menipis, catat pemesanan ke
              supplier, dan pantau penerimaannya sampai lengkap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={secondaryButton} href="/boq/materials">
              Material proyek / BoQ
            </Link>
            <Link className={secondaryButton} href="/warehouse">
              Buka Stok Gudang
            </Link>
          </div>
        </div>
        <ol className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3">
          {[
            {
              icon: Boxes,
              title: '1. Pantau kebutuhan restock',
              note: 'Stok pada atau di bawah minimum masuk daftar tindak lanjut.',
            },
            {
              icon: ClipboardList,
              title: '2. Catat order supplier',
              note: 'Isi jumlah manual, simpan draft, lalu tandai setelah dipesan.',
            },
            {
              icon: PackageCheck,
              title: '3. Terima ke gudang',
              note: 'Konfirmasi barang yang datang untuk menambah stok gudang.',
            },
          ].map((step) => (
            <li key={step.title} className="flex items-start gap-3">
              <step.icon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-teal-700"
              />
              <div>
                <p className="text-sm font-semibold text-[#17364a]">
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {step.note}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {data.demoMode && (
          <p className="mt-5 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Mode demo hanya baca. Penyimpanan dan penerimaan memerlukan
            database.
          </p>
        )}
      </section>
      <Metrics
        items={[
          { label: 'Stok perlu restock', value: data.metrics.lowStock },
          { label: 'Order terbuka', value: data.metrics.openOrders },
          { label: 'Order lewat ETA', value: data.metrics.lateOrders },
          {
            label: 'Diterima lengkap (total)',
            value: data.metrics.receivedOrders,
          },
        ]}
      />
      <MutationFeedback state={feedback} />

      <section className={panelClass} aria-labelledby="restock-queue-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Restock queue</p>
            <h3
              id="restock-queue-heading"
              className="mt-1 text-xl font-semibold"
            >
              Daftar kebutuhan restock
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Daftar diperbarui dari saldo dan batas minimum gudang. Order yang
              masih berjalan tetap terlihat agar pembelian tidak tercatat ganda.
            </p>
          </div>
          <label className="flex w-full max-w-sm items-center gap-2 rounded border border-slate-300 px-3">
            <Search
              aria-hidden="true"
              className="size-4 shrink-0 text-slate-400"
            />
            <input
              className="w-full py-2 text-sm outline-none"
              aria-label="Cari kebutuhan restock"
              value={stockSearch}
              onChange={(event) => setStockSearch(event.target.value)}
              placeholder="Cari kode atau nama material"
            />
          </label>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <caption className="sr-only">
              Stok menipis dan material dengan order terbuka
            </caption>
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                {[
                  'Material',
                  'Satuan',
                  'Stok tersedia',
                  'Minimum',
                  'Sisa order terbuka',
                  'Kondisi',
                  'Tindak lanjut',
                ].map((label) => (
                  <th scope="col" className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-b align-top" key={item.id}>
                  <td className="max-w-sm break-words p-3">
                    <strong className="font-mono">{item.code}</strong>
                    <p className="mt-1 text-slate-600">{item.description}</p>
                  </td>
                  <td className="p-3">{item.unit}</td>
                  <td className="p-3 font-mono font-semibold">
                    {formatOrderQuantity(item.quantity)}
                  </td>
                  <td className="p-3 font-mono">
                    {formatOrderQuantity(item.minQty)}
                  </td>
                  <td className="p-3 font-mono">
                    {formatOrderQuantity(item.openQty)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.belowMinimum ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}
                    >
                      {item.belowMinimum ? 'Perlu restock' : 'Order berjalan'}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.openOrderId ? (
                      <button
                        className={secondaryButton}
                        type="button"
                        onClick={() => showOpenOrder(item)}
                      >
                        Lihat order{' '}
                        <ArrowRight
                          aria-hidden="true"
                          className="ml-1.5 size-3.5"
                        />
                      </button>
                    ) : (
                      <button
                        className={secondaryButton}
                        type="button"
                        disabled={data.demoMode}
                        aria-label={`Buat order ${item.code}`}
                        onClick={() => open({ mode: 'create', item })}
                      >
                        Buat draft order
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 0 && (
            <p className="pt-3 text-xs text-slate-500 lg:hidden">
              Geser tabel untuk melihat stok, minimum, dan tindakan order.
            </p>
          )}
          {!items.length && (
            <p className="py-8 text-center text-sm leading-6 text-slate-500">
              {data.items.length
                ? 'Tidak ada material sesuai pencarian.'
                : 'Tidak ada stok yang perlu restock atau memiliki order terbuka.'}
            </p>
          )}
        </div>
      </section>

      <section
        id="material-order-history"
        className={`${panelClass} scroll-mt-24`}
        aria-labelledby="order-history-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Supplier order register</p>
            <h3
              id="order-history-heading"
              className="mt-1 flex items-center gap-2 text-xl font-semibold"
            >
              <Truck aria-hidden="true" className="size-5 text-teal-700" />{' '}
              Status dan riwayat order
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Pembelian material ke supplier terpisah dari PO Customer.
              Penerimaan dapat dicatat bertahap sesuai barang yang datang.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
          <Field label="Cari order">
            <input
              className={inputClass}
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder="Kode material, supplier, atau referensi"
            />
          </Field>
          <Field label="Filter status order">
            <select
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">Semua status</option>
              <option value="OPEN">Order terbuka</option>
              {materialOrderStatuses.map((value) => (
                <option value={value} key={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <caption className="sr-only">
              Daftar pemesanan material supplier dan jumlah penerimaan
            </caption>
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                {[
                  'Material / referensi',
                  'Supplier / ETA',
                  'Status',
                  'Dipesan',
                  'Diterima',
                  'Sisa',
                  'Tindakan',
                ].map((label) => (
                  <th scope="col" className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b align-top">
                  <td className="max-w-sm break-words p-3">
                    <strong className="font-mono text-[#17364a]">
                      {order.code}
                    </strong>
                    <p className="mt-1">{order.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {order.referenceNo || 'Referensi belum diisi'} ·{' '}
                      {date(order.createdAt)}
                    </p>
                    {order.notes && (
                      <details className="mt-2 text-xs text-slate-600">
                        <summary className="cursor-pointer">
                          Catatan order
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap leading-5">
                          {order.notes}
                        </p>
                      </details>
                    )}
                    {order.cancellationReason && (
                      <p className="mt-2 text-xs leading-5 text-red-700">
                        Alasan pembatalan: {order.cancellationReason}
                      </p>
                    )}
                  </td>
                  <td className="max-w-xs break-words p-3">
                    <p>{order.supplier || 'Supplier belum diisi'}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      ETA {date(order.expectedArrival)}
                    </p>
                    {order.expectedArrival &&
                      order.expectedArrival < data.today &&
                      (order.status === 'ORDERED' ||
                        order.status === 'PARTIAL') && (
                        <p className="mt-1 text-xs font-semibold text-red-700">
                          Lewat ETA
                        </p>
                      )}
                    <p className="mt-2 text-xs text-slate-500">
                      Dicatat: {order.createdByName}
                    </p>
                  </td>
                  <td className="p-3">
                    <Status value={order.status} />
                  </td>
                  <td className="whitespace-nowrap p-3 font-mono">
                    {formatOrderQuantity(order.quantity)} {order.unit}
                  </td>
                  <td className="whitespace-nowrap p-3 font-mono">
                    {formatOrderQuantity(order.receivedQty)} {order.unit}
                  </td>
                  <td className="whitespace-nowrap p-3 font-mono font-semibold">
                    {formatOrderQuantity(order.remainingQty)} {order.unit}
                  </td>
                  <td className="min-w-64 p-3">{actions(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 space-y-3 lg:hidden">
          {orders.map((order) => (
            <article
              className="rounded-lg border border-slate-200 p-4"
              key={order.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="break-all font-mono text-sm text-[#17364a]">
                  {order.code}
                </strong>
                <Status value={order.status} />
              </div>
              <p className="mt-2 text-sm leading-6">{order.description}</p>
              <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                {order.supplier || 'Supplier belum diisi'} ·{' '}
                {order.referenceNo || 'Referensi belum diisi'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ETA {date(order.expectedArrival)} · {date(order.createdAt)}
              </p>
              {order.expectedArrival &&
                order.expectedArrival < data.today &&
                (order.status === 'ORDERED' || order.status === 'PARTIAL') && (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    Lewat ETA
                  </p>
                )}
              <dl className="mt-4 grid grid-cols-3 gap-2 rounded bg-slate-50 p-3 text-xs">
                <div>
                  <dt className="text-slate-500">Dipesan</dt>
                  <dd className="mt-1 break-words font-mono">
                    {formatOrderQuantity(order.quantity)} {order.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Diterima</dt>
                  <dd className="mt-1 break-words font-mono">
                    {formatOrderQuantity(order.receivedQty)} {order.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sisa</dt>
                  <dd className="mt-1 break-words font-mono font-semibold">
                    {formatOrderQuantity(order.remainingQty)} {order.unit}
                  </dd>
                </div>
              </dl>
              {order.notes && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                  {order.notes}
                </p>
              )}
              {order.cancellationReason && (
                <p className="mt-3 text-xs leading-5 text-red-700">
                  Alasan pembatalan: {order.cancellationReason}
                </p>
              )}
              <div className="mt-4 border-t border-slate-200 pt-3">
                {actions(order)}
              </div>
            </article>
          ))}
        </div>
        {!orders.length && (
          <p className="py-8 text-center text-sm text-slate-500">
            {data.orders.length
              ? 'Tidak ada order sesuai filter.'
              : 'Belum ada order material. Pilih barang pada daftar restock untuk membuat draft.'}
          </p>
        )}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Semua order terbuka serta 100 order selesai atau dibatalkan terbaru
          ditampilkan. Detail penerimaan tercatat di{' '}
          <Link
            className="font-medium text-teal-800 underline"
            href="/warehouse"
          >
            riwayat transaksi gudang
          </Link>
          .
        </p>
      </section>
      {selection && (
        <MaterialOrderForm
          key={`${selection.mode}-${'item' in selection ? selection.item.id : selection.order.id}`}
          selection={selection}
          demo={data.demoMode}
          requestId={dialogRequestId}
          actorName={actorName}
          onClose={() => setSelection(null)}
          onSaved={(result) => {
            setFeedback(result);
            setSelection(null);
          }}
        />
      )}
    </main>
  );
}
