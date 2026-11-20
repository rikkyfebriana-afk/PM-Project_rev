import Link from 'next/link';
import { ArrowUpRight, CalendarDays, FileText } from 'lucide-react';

import type { CurrentUser } from '@/lib/auth/session';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import { poStatusLabels } from '@/lib/customer-po/validation';
import { buildMonthlyPo } from '@/lib/dashboard/po-monthly';
import { exactPoMoney, summarizeFinancePo } from '@/lib/finance/po-summary';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { PoMonthlyChart } from './po-monthly-chart';

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const healthLabels: Record<string, { label: string; className: string }> = {
  ON_TRACK: { label: 'On track', className: 'bg-teal-50 text-teal-800' },
  ATTENTION: { label: 'Attention', className: 'bg-amber-50 text-amber-800' },
  CRITICAL: { label: 'Critical', className: 'bg-red-50 text-red-800' },
};
const phaseLabels: Record<string, string> = {
  PLANNING: 'Perencanaan',
  ENGINEERING: 'Engineering',
  PROCUREMENT: 'Pengadaan',
  PRODUCTION: 'Produksi',
  FAT: 'FAT',
  DELIVERY: 'Delivery',
  INSTALLATION: 'Instalasi',
  BAST: 'BAST',
  CLOSED: 'Closed',
};
const modules = [
  ['/finance', 'Finance'],
  ['/boq', 'BoQ'],
  ['/time-plan', 'Time Plan'],
  ['/team-targets', 'Target Tim'],
  ['/materials', 'Material'],
  ['/production', 'Produksi'],
  ['/fat', 'FAT'],
  ['/delivery', 'Delivery'],
  ['/site-work', 'Site Work'],
] as const;
const panelClass = 'min-w-0 rounded-xl border border-slate-200 bg-white';
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export async function ViewerDashboard({ user }: { user: CurrentUser }) {
  const [projects, po, documents] = await Promise.all([
    prisma.project.findMany({
      where: accessibleProjectWhere(user),
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        health: true,
        phase: true,
        address: true,
        progressPct: true,
        plannedFinish: true,
      },
    }),
    prisma.project.findMany({
      where: accessibleProjectWhere(user, 'PO'),
      select: {
        id: true,
        poValue: true,
        customerPoNumber: true,
        customerPoStatus: true,
        customerPoDate: true,
        customerPoCompletedDate: true,
      },
    }),
    prisma.document.findMany({
      where: {
        project: { is: accessibleProjectWhere(user, 'DOCUMENTS') },
        deletedAt: null,
        status: 'READY',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        originalName: true,
        project: { select: { code: true } },
      },
    }),
  ]);
  const poRows = po.map((project) => ({
    ...project,
    poValue: project.poValue.toFixed(2),
    customerPoDate: project.customerPoDate?.toISOString().slice(0, 10) ?? null,
    customerPoCompletedDate:
      project.customerPoCompletedDate?.toISOString().slice(0, 10) ?? null,
  }));
  const poByProject = new Map(poRows.map((project) => [project.id, project]));
  const summary = summarizeFinancePo(poRows);
  const active = projects.filter((project) => project.status === 'ACTIVE');
  const today = dateOnlyInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || 'Asia/Jakarta',
  );
  const portfolio = [
    {
      label: 'Active',
      count: active.length,
      note: 'Proyek aktif',
      color: 'border-l-[#17364a]',
    },
    {
      label: 'On track',
      count: active.filter((project) => project.health === 'ON_TRACK').length,
      note: 'Proyek aktif sesuai rencana',
      color: 'border-l-teal-600',
    },
    {
      label: 'Attention',
      count: active.filter((project) => project.health === 'ATTENTION').length,
      note: 'Memerlukan perhatian',
      color: 'border-l-amber-500',
    },
    {
      label: 'Critical',
      count: active.filter((project) => project.health === 'CRITICAL').length,
      note: 'Memerlukan tindak lanjut segera',
      color: 'border-l-red-500',
    },
    {
      label: 'Closed',
      count: projects.filter((project) => project.status === 'CLOSED').length,
      note: 'Proyek selesai',
      color: 'border-l-slate-400',
    },
  ];

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 lg:pb-9 xl:p-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Dashboard Viewer
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pantau proyek, PO Customer, dan dokumen sesuai izin akun Anda.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          <CalendarDays size={15} aria-hidden="true" /> Data per{' '}
          {dateFormat.format(today)}
        </div>
      </header>

      <section aria-labelledby="viewer-health-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="viewer-health-heading"
            className="text-base font-semibold text-slate-900"
          >
            Ringkasan proyek
          </h2>
          <a
            href="#viewer-projects"
            className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
          >
            Lihat {projects.length} proyek
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {portfolio.map((item) => (
            <article
              key={item.label}
              className={`${panelClass} border-l-4 ${item.color} p-4`}
            >
              <p className="text-xs font-semibold text-slate-600">
                {item.label}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">
                {item.count}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {item.note}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section
          className={`${panelClass} p-5`}
          aria-labelledby="viewer-po-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id="viewer-po-heading"
              className="text-base font-semibold text-slate-900"
            >
              PO Customer yang diizinkan
            </h2>
            <Link
              href="/customer-po"
              className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
            >
              Buka daftar PO
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((group) => (
              <Link
                href="/customer-po"
                key={group.key}
                className={`min-w-0 rounded-lg bg-slate-50 p-3 transition hover:bg-teal-50 ${focusClass}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">
                    {group.label}
                  </p>
                  <p className="rounded bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                    {group.count}
                  </p>
                </div>
                <p className="mt-3 break-words font-mono text-base font-semibold tabular-nums text-[#17364a]">
                  {exactPoMoney(group.value)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {group.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <nav
          className={`${panelClass} p-5`}
          aria-labelledby="viewer-modules-heading"
        >
          <h2
            id="viewer-modules-heading"
            className="text-base font-semibold text-slate-900"
          >
            Akses modul
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Setiap modul menampilkan proyek sesuai izin Admin atau Project
            Manager.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {modules.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 ${focusClass}`}
              >
                <span>{label}</span>
                <ArrowUpRight
                  size={14}
                  className="shrink-0 text-slate-400"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <PoMonthlyChart data={buildMonthlyPo(poRows, today.getUTCFullYear())} />

      <section
        id="viewer-projects"
        className={`${panelClass} scroll-mt-24`}
        aria-labelledby="viewer-projects-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-200 p-5">
          <h2
            id="viewer-projects-heading"
            className="text-base font-semibold text-slate-900"
          >
            Daftar proyek — {projects.length}
          </h2>
          <span className="text-xs text-slate-500">
            Progres dan target setiap proyek
          </span>
        </div>
        <div
          className="overflow-x-auto rounded-b-xl focus-visible:outline-2 focus-visible:outline-teal-700"
          role="region"
          aria-label="Tabel proyek Viewer"
          tabIndex={0}
        >
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Daftar proyek dan PO Customer sesuai izin Viewer
            </caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {[
                  'Proyek',
                  'Lokasi',
                  'Fase',
                  'Progress',
                  'Target selesai',
                  'Health',
                  'PO Customer',
                  'Nilai PO',
                ].map((heading) => (
                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                    key={heading}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => {
                const allowedPo = poByProject.get(project.id);
                const health = healthLabels[project.health];
                return (
                  <tr key={project.id} className="align-top hover:bg-slate-50">
                    <th
                      scope="row"
                      className="min-w-[250px] max-w-[340px] px-4 py-4 text-left font-normal"
                    >
                      <p className="text-xs font-semibold text-[#d85832]">
                        {project.code}
                      </p>
                      <p className="mt-1 break-words font-medium leading-6 text-slate-900">
                        {project.name}
                      </p>
                    </th>
                    <td className="min-w-40 max-w-[220px] break-words px-4 py-4 text-slate-600">
                      {project.address || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {phaseLabels[project.phase] ?? project.phase}
                    </td>
                    <td className="min-w-36 px-4 py-4">
                      <span className="font-mono text-xs font-semibold tabular-nums">
                        {project.progressPct.toString()}%
                      </span>
                      <progress
                        className="project-progress mt-2"
                        max={100}
                        value={project.progressPct.toNumber()}
                        aria-label={`Progress ${project.code}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {project.plannedFinish
                        ? dateFormat.format(project.plannedFinish)
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${health?.className ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {health?.label ?? project.health}
                      </span>
                    </td>
                    <td className="min-w-40 max-w-[220px] break-words px-4 py-4">
                      {allowedPo ? (
                        <>
                          <p className="font-medium text-slate-800">
                            {allowedPo.customerPoNumber || 'Belum tercatat'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {poStatusLabels[allowedPo.customerPoStatus] ??
                              allowedPo.customerPoStatus}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Tidak diizinkan
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-sm tabular-nums text-[#17364a]">
                      {allowedPo ? (
                        exactPoMoney(allowedPo.poValue)
                      ) : (
                        <span className="font-sans text-xs text-slate-500">
                          Tidak diizinkan
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!projects.length && (
            <p className="p-6 text-sm text-slate-500">
              Tidak ada proyek yang diizinkan.
            </p>
          )}
        </div>
      </section>

      <section
        className={`${panelClass} p-5`}
        aria-labelledby="viewer-documents-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="viewer-documents-heading"
            className="text-base font-semibold text-slate-900"
          >
            Dokumen yang diizinkan
          </h2>
          <p className="text-xs text-slate-500">
            {documents.length} dokumen · maksimal 50 terbaru
          </p>
        </div>
        {documents.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <Link
                key={document.id}
                className={`flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50 ${focusClass}`}
                href={`/api/documents/${document.id}/download`}
              >
                <FileText
                  size={18}
                  className="mt-0.5 shrink-0 text-teal-700"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-500">
                    {document.project.code}
                  </span>
                  <span className="mt-1 block break-words text-sm font-medium leading-6 text-slate-800">
                    {document.originalName}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Tidak ada dokumen yang diizinkan atau siap diunduh.
          </p>
        )}
      </section>
    </main>
  );
}
