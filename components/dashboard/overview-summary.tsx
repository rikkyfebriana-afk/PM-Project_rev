import Link from 'next/link';
import { ArrowUpRight, ClipboardCheck } from 'lucide-react';

import type { DashboardData } from '@/lib/dashboard/types';
import { exactPoMoney } from '@/lib/finance/po-summary';
import { DashboardInvoiceSummary } from './invoice-summary';

type Overview = NonNullable<DashboardData['overview']>;
type OverviewSection = 'commercial' | 'operations';

const panelClass = 'min-w-0 rounded-xl border border-slate-200 bg-white';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const linkClass = `inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline ${focusClass}`;

function CustomerPoSummary({ data }: { data: DashboardData }) {
  return (
    <section
      className={panelClass}
      aria-labelledby="customer-po-summary-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3
            id="customer-po-summary-heading"
            className="text-base font-semibold text-slate-900"
          >
            PO Customer — jumlah & nilai per status
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Nilai PO sebelum PPN pada seluruh proyek yang dapat diakses.
          </p>
        </div>
        <Link href="/customer-po" className={linkClass}>
          Buka PO <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="px-5 pb-2 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1.3fr)] gap-2 pb-2 text-xs font-medium text-slate-500">
          <span>Status PO</span>
          <span className="text-center">Jumlah</span>
          <span className="text-right">Nilai PO</span>
        </div>
        <div className="divide-y divide-slate-100">
          {data.poSummary?.map((po) => (
            <Link
              key={po.key}
              href="/customer-po"
              className={`grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1.3fr)] items-center gap-2 rounded-lg py-3 transition hover:bg-slate-50 ${focusClass}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {po.label}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {po.description}
                </p>
              </div>
              <p className="text-center font-mono text-base font-semibold tabular-nums text-slate-800">
                {po.count}
              </p>
              <p className="min-w-0 break-words text-right font-mono text-sm font-semibold tabular-nums text-slate-900">
                {exactPoMoney(po.value)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuotationSummary({ overview }: { overview: Overview }) {
  if (!overview.quotations) return null;
  return (
    <section className={panelClass} aria-labelledby="quotation-summary-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3
            id="quotation-summary-heading"
            className="text-base font-semibold text-slate-900"
          >
            Quotation / SPH
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Admin / Project Manager · nilai penawaran yang tercatat.
          </p>
        </div>
        <Link href="/quotations" className={linkClass}>
          Buka SPH <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.quotations.map((quotation) => (
          <Link
            key={quotation.label}
            href="/quotations"
            className={`min-w-0 rounded-lg bg-slate-50 px-4 py-3 transition hover:bg-teal-50 ${focusClass}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold leading-5 text-slate-600">
                {quotation.label}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-slate-900">
                {quotation.count}
              </p>
            </div>
            <p className="mt-2 break-words font-mono text-sm font-semibold text-slate-900">
              {quotation.value}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TeamTargets({ overview }: { overview: Overview }) {
  const statistics = [
    ['Target hari ini', overview.achievement.count],
    ['Selesai', overview.achievement.done],
    ['Belum selesai', overview.achievement.remaining],
    ['Tertunda sebelum hari ini', overview.overdue],
  ] as const;

  return (
    <section
      className={panelClass}
      aria-labelledby="team-targets-summary-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h3
          id="team-targets-summary-heading"
          className="text-base font-semibold text-slate-900"
        >
          Target Tim hari ini
        </h3>
        <Link href="/team-targets" className={linkClass}>
          Rencana & WhatsApp{' '}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            {statistics.map(([label, value]) => (
              <Link
                key={label}
                href="/team-targets"
                className={`rounded-lg bg-slate-50 p-4 transition hover:bg-teal-50 ${focusClass}`}
              >
                <p className="text-xs font-medium leading-5 text-slate-600">
                  {label}
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {value}
                </p>
              </Link>
            ))}
          </div>
          <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="daily-target-achievement"
                className="text-sm font-semibold text-teal-900"
              >
                Pencapaian target hari ini
              </label>
              <span className="font-mono text-lg font-bold tabular-nums text-teal-900">
                {overview.achievement.percent.toFixed(1)}%
              </span>
            </div>
            <progress
              id="daily-target-achievement"
              max={100}
              value={overview.achievement.percent}
              className="project-progress mt-3"
            />
            <p className="mt-2 text-xs leading-5 text-teal-900/80">
              Rata-rata realisasi terhadap target tiap aktivitas.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 p-5 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Prioritas tindak lanjut
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Lima aktivitas terlama yang belum selesai.
              </p>
            </div>
            <ClipboardCheck
              className="size-5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {overview.queue.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/team-targets?week=${task.scheduledDate}`}
                  className={`block rounded-lg py-3 transition hover:text-teal-800 ${focusClass}`}
                >
                  <p className="break-words text-sm font-semibold leading-5">
                    {task.title}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {task.pic} · {task.project} · {task.scheduledDate}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {!overview.queue.length && (
            <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Tidak ada aktivitas tertunda atau target hari ini yang belum
              selesai.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function OverviewSummary({
  data,
  section,
}: {
  data: DashboardData;
  section?: OverviewSection;
}) {
  const overview = data.overview;
  if (!overview) return null;

  const showCommercial = section === undefined || section === 'commercial';
  const showOperations = section === undefined || section === 'operations';

  return (
    <div className="space-y-6">
      {showCommercial && (
        <div className="space-y-6">
          <div className="grid items-stretch gap-5 xl:grid-cols-2">
            <CustomerPoSummary data={data} />
            {overview.invoices && (
              <DashboardInvoiceSummary summary={overview.invoices} />
            )}
          </div>
          <QuotationSummary overview={overview} />
        </div>
      )}
      {showOperations && (
        <section aria-labelledby="overview-heading" className="space-y-4">
          <h2
            id="overview-heading"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Pantauan seluruh modul
          </h2>
          <TeamTargets overview={overview} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overview.modules.map((module) => (
              <Link
                key={module.label}
                href={module.href}
                className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-300 hover:bg-teal-50/30 ${focusClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {module.label}
                  </h3>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {module.value}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {module.unit}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {module.note}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
