import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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

const invoiceStatuses: InvoiceStatus[] = [
  'OVERDUE',
  'SENT',
  'PARTIAL',
  'PAID',
  'DRAFT',
  'VOID',
];
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
      className="min-w-0 rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3
            id="invoice-summary-heading"
            className="text-base font-semibold text-slate-900"
          >
            Ringkasan Status Invoice
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Nilai akhir tagihan dan pembayaran customer.
          </p>
        </div>
        <Link
          href="/invoices"
          className={`inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
        >
          Buka invoice <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {invoiceTotals.map(({ key, label, href }) => {
          const overdue = key === 'overdue' && summary.counts.OVERDUE > 0;
          return (
            <Link
              key={key}
              href={href}
              data-invoice-total={key}
              className={`min-w-0 rounded-lg border p-4 transition ${focusClass} ${overdue ? 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100' : 'border-slate-100 bg-slate-50 text-slate-800 hover:bg-teal-50'}`}
            >
              <p className="text-xs font-semibold leading-5">{label}</p>
              <p className="mt-2 break-words font-mono text-lg font-bold tabular-nums">
                {exactPoMoney(summary.totals[key])}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="border-t border-slate-100 p-5 pt-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Jumlah invoice per status
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {invoiceStatuses.map((status) => (
            <Link
              key={status}
              href={`/invoices?status=${status}`}
              data-invoice-count={status}
              className={`min-w-0 rounded-lg border p-3 transition ${focusClass} ${status === 'OVERDUE' && summary.counts.OVERDUE > 0 ? 'border-red-200 bg-red-50/50 text-red-800 hover:bg-red-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
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
      </div>
    </section>
  );
}
