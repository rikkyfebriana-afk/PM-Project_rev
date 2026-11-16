import Link from 'next/link';
import type { DashboardData } from '@/lib/dashboard/types';
import { exactPoMoney } from '@/lib/finance/po-summary';
import {
  invoiceStatusLabels,
  type InvoiceStatus,
} from '@/lib/invoices/summary';

type InvoiceSummary = NonNullable<
  NonNullable<DashboardData['overview']>['invoices']
>;

const invoiceTotals = [
  { key: 'billed', label: 'Total invoice terkirim', href: '/invoices' },
  { key: 'paid', label: 'Pembayaran diterima', href: '/invoices' },
  { key: 'balance', label: 'Sisa tagihan', href: '/invoices' },
  {
    key: 'overdue',
    label: 'Sisa lewat jatuh tempo',
    href: '/invoices?status=OVERDUE',
  },
] as const;

const invoiceStatuses = Object.keys(invoiceStatusLabels) as InvoiceStatus[];
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export function DashboardInvoiceSummary({
  summary,
}: {
  summary: InvoiceSummary;
}) {
  return (
    <section
      aria-labelledby="invoice-summary-heading"
      className="border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="invoice-summary-heading" className="font-semibold">
          Ringkasan Status Invoice
        </h3>
        <Link
          href="/invoices"
          className={`text-sm font-semibold text-teal-800 underline ${focusClass}`}
        >
          Buka daftar invoice
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {invoiceTotals.map(({ key, label, href }) => {
          const overdue = key === 'overdue';
          return (
            <Link
              key={key}
              href={href}
              data-invoice-total={key}
              className={`min-w-0 border-l-4 p-4 ${focusClass} ${overdue ? 'border-red-500 bg-red-50 text-red-900 hover:bg-red-100' : 'border-teal-600 bg-slate-50 hover:bg-teal-50'}`}
            >
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-2 break-words font-mono text-lg font-bold tabular-nums">
                {exactPoMoney(summary.totals[key])}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {invoiceStatuses.map((status) => (
          <Link
            key={status}
            href={`/invoices?status=${status}`}
            data-invoice-count={status}
            className={`min-w-0 rounded border p-3 ${focusClass} ${status === 'OVERDUE' ? 'border-red-200 text-red-800 hover:bg-red-50' : 'border-slate-200 text-slate-700 hover:bg-teal-50'}`}
          >
            <p className="text-xs font-semibold">
              {invoiceStatusLabels[status]}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {summary.counts[status]}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
