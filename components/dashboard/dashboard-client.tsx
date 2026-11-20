'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Download,
  Filter,
  MapPin,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectMap } from '@/components/map/project-map';
import { buildCsv } from '@/lib/csv';
import { dashboardCategoryHref } from '@/lib/dashboard/categories';
import type {
  DashboardData,
  DashboardHealth,
  DashboardHealthFilter,
  DashboardProject,
} from '@/lib/dashboard/types';
import { OverviewSummary } from './overview-summary';
import { PoMonthlyChart } from './po-monthly-chart';

const healthLabels: Record<DashboardHealthFilter, string> = {
  All: 'Semua',
  'On track': 'On track',
  Attention: 'Perhatian',
  Critical: 'Kritis',
};
const statusLabels: Record<string, string> = {
  Active: 'Proyek aktif',
  'On track': 'On track',
  Attention: 'Perlu perhatian',
  Critical: 'Kritis',
  Closed: 'Proyek selesai',
};
const statusNotes: Record<string, string> = {
  Active: 'Seluruh proyek yang sedang berjalan',
  'On track': 'Proyek aktif dengan kondisi baik',
  Attention: 'Memerlukan tindak lanjut tim',
  Critical: 'Memerlukan penanganan segera',
  Closed: 'Pekerjaan proyek sudah selesai',
};
const statusTones = {
  navy: 'border-t-[#17364a]',
  green: 'border-t-teal-600',
  amber: 'border-t-amber-400',
  red: 'border-t-red-500',
  slate: 'border-t-slate-400',
};
const financeLabels: Record<string, string> = {
  'PO Value': 'Nilai PO',
  Budget: 'Budget',
  Actual: 'Biaya aktual',
  Forecast: 'Perkiraan biaya',
  Margin: 'Perkiraan GM',
};
const alertLabels: Record<string, string> = {
  'Material shortage': 'Kekurangan material',
  'Delayed project': 'Proyek terlambat',
  'FAT punch list': 'Punch list FAT',
  'Budget risk': 'Risiko budget',
};
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const panelClass = 'min-w-0 rounded-xl border border-slate-200 bg-white';

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function translatedNote(note: string) {
  return note
    .replace('Active portfolio', 'Nilai proyek aktif')
    .replace('Forecast gross margin', 'Margin berdasarkan perkiraan biaya')
    .replace('% of PO', '% dari nilai PO')
    .replace('% used', '% budget terpakai')
    .replace(/ under$/, ' di bawah budget')
    .replace(/ over$/, ' di atas budget')
    .replace(' projects impacted', ' proyek terdampak')
    .replace('Avg. ', 'Rata-rata ')
    .replace(' days behind', ' hari terlambat')
    .replace('No overdue projects', 'Tidak ada proyek terlambat')
    .replace(' open action items', ' tindak lanjut terbuka')
    .replace(
      'Forecast at or over 95%',
      'Perkiraan biaya mencapai minimal 95% budget',
    );
}

function filterProjects(
  projects: DashboardProject[],
  query: string,
  health: DashboardHealthFilter,
) {
  const needle = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      [project.id, project.name, project.city, project.phase].some((value) =>
        value.toLowerCase().includes(needle),
      ) &&
      (health === 'All' || project.health === health),
  );
}

function HealthBadge({ health }: { health: DashboardHealth }) {
  const styles = {
    'On track': 'bg-teal-50 text-teal-800 ring-teal-600/15',
    Attention: 'bg-amber-50 text-amber-900 ring-amber-500/20',
    Critical: 'bg-red-50 text-red-800 ring-red-500/15',
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[health]}`}
    >
      {healthLabels[health]}
    </span>
  );
}

type ModelContextApi = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

export function DashboardClient({ data }: { data: DashboardData }) {
  const {
    portfolioStatus,
    finance,
    alerts,
    mapProjects,
    milestones,
    projects,
  } = data;
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] =
    useState<DashboardHealthFilter>('All');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const visibleProjects = useMemo(
    () => filterProjects(projects, searchTerm, healthFilter),
    [projects, searchTerm, healthFilter],
  );
  const selected = projects.find((project) => project.id === selectedProject);
  const businessDate = data.overview?.date;
  const dateLabel = businessDate
    ? new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${businessDate}T00:00:00Z`))
    : '';

  useEffect(() => {
    const modelContext = (
      document as Document & { modelContext?: ModelContextApi }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = modelContext.registerTool(
      {
        name: 'filter_project_portfolio',
        title: 'Filter project portfolio',
        description:
          'Filter the visible project portfolio by a search query and health status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Project name, ID, city, or phase.',
            },
            health: {
              type: 'string',
              enum: ['All', 'On track', 'Attention', 'Critical'],
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (typeof input !== 'object' || input === null)
            throw new Error('Input must be an object.');
          const values = input as Record<string, unknown>;
          const query = values.query === undefined ? '' : values.query;
          const health = values.health === undefined ? 'All' : values.health;
          if (typeof query !== 'string')
            throw new Error('Query must be a string.');
          if (
            !['All', 'On track', 'Attention', 'Critical'].includes(
              String(health),
            )
          )
            throw new Error('Health filter is invalid.');
          const safeHealth = health as DashboardHealthFilter;
          const matches = filterProjects(projects, query, safeHealth);
          setSearchTerm(query);
          setHealthFilter(safeHealth);
          return {
            query,
            health: safeHealth,
            matchingCount: matches.length,
            projectIds: matches.map((project) => project.id),
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [projects]);

  function exportPortfolio() {
    const header = [
      'ID',
      'Project',
      'City',
      'Progress',
      'Material',
      'Phase',
      'Finish',
      'Health',
      'GM',
    ];
    const rows = visibleProjects.map((project) => [
      project.id,
      project.name,
      project.city,
      formatPercent(project.progress),
      formatPercent(project.material),
      project.phase,
      project.finish,
      project.health,
      formatPercent(project.gm),
    ]);
    const url = URL.createObjectURL(
      new Blob([buildCsv([header, ...rows])], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'project-portfolio.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setSearchTerm('');
    setHealthFilter('All');
    setSelectedProject(null);
  }

  return (
    <main className="mx-auto min-w-0 max-w-[1680px] space-y-7 p-4 pb-24 md:p-6 lg:pb-8 xl:px-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              Project Control Center
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Ringkasan proyek
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Pantau kondisi proyek, penagihan, dan prioritas tim dalam satu
              halaman.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarDays className="size-4" aria-hidden="true" />
              {data.demoMode
                ? 'Mode demo'
                : dateLabel || 'Data terbaru saat halaman dibuka'}
            </p>
            <div className="flex gap-2">
              <Link
                href="/customer-po"
                className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${focusClass}`}
              >
                PO Customer
              </Link>
              <Link
                href="/invoices"
                className={`rounded-lg bg-[#17364a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#24536b] ${focusClass}`}
              >
                Status Invoice{' '}
                <ArrowUpRight
                  className="ml-1 inline size-3.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>
        <nav
          aria-label="Bagian Dashboard"
          className="flex flex-wrap gap-2 border-b border-slate-200 pb-4"
        >
          {[
            ['#portfolio-heading', 'Kondisi proyek'],
            ['#priorities-heading', 'Prioritas'],
            ['#commercial-heading', 'Keuangan & PO'],
            ['#operations-heading', 'Operasional'],
            ['#locations-heading', 'Lokasi & milestone'],
            ['#portfolio-table', 'Daftar proyek'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-[#17364a] ${focusClass}`}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section aria-labelledby="portfolio-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="portfolio-heading"
            className="scroll-mt-28 text-base font-semibold text-slate-900"
          >
            Kondisi proyek
          </h2>
          <p className="text-xs text-slate-500">
            Pilih kategori untuk membuka daftar site
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {portfolioStatus.map((item) => (
            <Link
              key={item.label}
              href={dashboardCategoryHref(item.label)}
              aria-label={`Lihat daftar site ${item.label}`}
              className={`${panelClass} border-t-[3px] p-4 transition hover:shadow-sm ${focusClass} ${statusTones[item.tone]} ${item.label === 'Closed' ? 'col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">
                  {statusLabels[item.label] || item.label}
                </p>
                <ArrowUpRight
                  className="size-3.5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 font-mono text-3xl font-semibold leading-none tabular-nums text-slate-900">
                {item.value}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {statusNotes[item.label] || item.note}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="priorities-heading"
        className={`${panelClass} p-5`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="priorities-heading"
            className="flex scroll-mt-28 items-center gap-2 text-base font-semibold text-slate-900"
          >
            <AlertTriangle
              className="size-4 text-[#d85832]"
              aria-hidden="true"
            />
            Prioritas tindak lanjut
          </h2>
          <Link
            href="/actions"
            className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
          >
            Buka Action Center →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {alerts.map((alert) => (
            <Link
              key={alert.title}
              href={dashboardCategoryHref(alert.title)}
              aria-label={`Lihat daftar site ${alert.title}`}
              className={`min-w-0 rounded-lg border p-4 ${focusClass} ${alert.count > 0 ? (alert.tone === 'red' ? 'border-red-100 bg-red-50/60 hover:bg-red-50' : 'border-amber-100 bg-amber-50/60 hover:bg-amber-50') : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  {alertLabels[alert.title] || alert.title}
                </h3>
                <strong
                  className={`font-mono text-2xl tabular-nums ${alert.count > 0 ? (alert.tone === 'red' ? 'text-red-700' : 'text-amber-800') : 'text-slate-500'}`}
                >
                  {alert.count}
                </strong>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {translatedNote(alert.detail)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="commercial-heading"
              className="scroll-mt-28 text-lg font-semibold text-slate-900"
            >
              Keuangan &amp; PO Customer
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Posisi keuangan proyek aktif, status PO, dan pembayaran customer.
            </p>
          </div>
          <Link
            href="/finance"
            className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
          >
            Buka Finance →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {finance.map((item) => (
            <article
              key={item.label}
              className={`min-w-0 rounded-xl bg-[#17364a] p-4 text-white ${item.label === 'Margin' ? 'sm:col-span-2 xl:col-span-1' : ''}`}
            >
              <h3 className="text-xs font-medium text-slate-200">
                {financeLabels[item.label] || item.label}
              </h3>
              <p
                className="mt-3 break-words font-mono text-xl font-semibold leading-7 tabular-nums tracking-tight"
                title={item.value}
              >
                {item.value}
              </p>
              <p
                className={`mt-2 text-xs leading-5 ${item.direction === 'down' ? 'text-red-200' : 'text-slate-300'}`}
              >
                {translatedNote(item.change)}
              </p>
            </article>
          ))}
        </div>
        <OverviewSummary data={data} section="commercial" />
        {data.monthlyPo && <PoMonthlyChart data={data.monthlyPo} />}
      </section>

      <section aria-labelledby="operations-heading" className="space-y-4">
        <div>
          <h2
            id="operations-heading"
            className="scroll-mt-28 text-lg font-semibold text-slate-900"
          >
            Operasional &amp; aktivitas tim
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Pencapaian harian dan pekerjaan yang memerlukan tindak lanjut.
          </p>
        </div>
        <OverviewSummary data={data} section="operations" />
      </section>

      <section aria-labelledby="locations-heading" className="space-y-4">
        <h2
          id="locations-heading"
          className="scroll-mt-28 text-lg font-semibold text-slate-900"
        >
          Lokasi &amp; milestone proyek
        </h2>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <article className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 p-5">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                  <MapPin className="size-4 text-teal-700" aria-hidden="true" />
                  Peta lokasi proyek
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {mapProjects.length} lokasi ditampilkan · pilih marker untuk
                  menyorot proyek
                </p>
              </div>
              <Link
                href="/projects"
                className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
              >
                Buka Projects →
              </Link>
            </div>
            <ProjectMap
              projects={mapProjects}
              onSelect={(projectId) => {
                setSearchTerm(projectId);
                setHealthFilter('All');
                setSelectedProject(projectId);
                document
                  .getElementById('portfolio-table')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </article>
          <section aria-labelledby="milestone-heading" className={panelClass}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h3
                  id="milestone-heading"
                  className="font-semibold text-slate-900"
                >
                  Milestone 30 hari ke depan
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {milestones.length} jadwal terdekat
                </p>
              </div>
              <Link
                href="/time-plan"
                aria-label="Buka Time Plan"
                className={`rounded-lg border border-slate-200 p-2 text-teal-800 hover:bg-slate-50 ${focusClass}`}
              >
                <CalendarDays className="size-4" />
              </Link>
            </div>
            {milestones.length ? (
              <ul className="divide-y divide-slate-100">
                {milestones.map((milestone, index) => (
                  <li
                    key={`${milestone.label}-${index}`}
                    className="flex items-start gap-3 p-5"
                  >
                    <div
                      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg ${milestone.state === 'risk' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-[#17364a]'}`}
                    >
                      <strong className="font-mono text-xl leading-none">
                        {milestone.day}
                      </strong>
                      <span className="mt-1 text-xs">{milestone.month}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="break-words text-sm font-semibold text-slate-800">
                        {milestone.label}
                      </h4>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {milestone.meta}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium ${milestone.state === 'risk' ? 'text-amber-800' : 'text-teal-700'}`}
                      >
                        {milestone.state === 'risk'
                          ? 'Perlu perhatian'
                          : 'Sesuai jadwal'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
                <CalendarDays
                  className="size-7 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm text-slate-500">
                  Belum ada milestone dalam 30 hari ke depan.
                </p>
                <Link
                  href="/time-plan"
                  className={`text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
                >
                  Lihat rencana proyek →
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>

      <section
        id="portfolio-table"
        aria-labelledby="project-table-heading"
        className={`${panelClass} scroll-mt-28 overflow-hidden`}
      >
        <header className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="project-table-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Daftar proyek
              </h2>
              <p className="mt-1 text-xs text-slate-500" role="status">
                Menampilkan {visibleProjects.length} dari {projects.length}{' '}
                proyek.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportPortfolio}
              className="h-9 gap-2 rounded-lg border-slate-300 px-3 text-xs shadow-none"
            >
              <Download className="size-4" aria-hidden="true" />
              Ekspor CSV
            </Button>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Cari proyek pada portfolio"
                placeholder="Cari nama, kode, lokasi, atau fase..."
                className="h-10 border-slate-300 bg-white pl-9 text-sm shadow-none"
              />
            </div>
            <div
              role="group"
              aria-label="Filter kondisi proyek"
              className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
            >
              {(
                [
                  'All',
                  'On track',
                  'Attention',
                  'Critical',
                ] as DashboardHealthFilter[]
              ).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHealthFilter(filter)}
                  aria-pressed={healthFilter === filter}
                  className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${focusClass} ${healthFilter === filter ? 'bg-[#17364a] text-white' : 'text-slate-600 hover:bg-white'}`}
                >
                  {healthLabels[filter]}
                </button>
              ))}
            </div>
          </div>
        </header>
        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-teal-50 px-5 py-3">
            <p className="min-w-0 flex-1 break-words text-sm text-teal-900">
              <strong>{selected.id}</strong> · {selected.name}
            </p>
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className={`rounded text-xs font-semibold text-teal-800 hover:underline ${focusClass}`}
            >
              Hapus sorotan
            </button>
          </div>
        )}
        {visibleProjects.length ? (
          <>
            <div
              className="hidden overflow-x-auto md:block"
              role="region"
              aria-label="Tabel portfolio proyek"
              tabIndex={0}
            >
              <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Progres, material, fase, target selesai, kondisi, dan
                  perkiraan gross margin proyek
                </caption>
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    {[
                      'Proyek / lokasi',
                      'Progres',
                      'Material',
                      'Fase',
                      'Target selesai',
                      'Kondisi',
                      'GM',
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className={`px-4 py-3 font-semibold ${label === 'GM' ? 'text-right' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleProjects.map((project) => (
                    <tr
                      key={project.id}
                      className={
                        selectedProject === project.id
                          ? 'bg-teal-50/60'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <th
                        scope="row"
                        className="min-w-[240px] max-w-[400px] px-4 py-4 font-normal"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedProject(project.id)}
                          aria-pressed={selectedProject === project.id}
                          className={`rounded text-left ${focusClass}`}
                        >
                          <strong className="block break-words text-sm font-semibold leading-5 text-slate-800">
                            {project.name}
                          </strong>
                          <span className="mt-1 block text-xs text-slate-500">
                            {project.id} · {project.city}
                          </span>
                        </button>
                      </th>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[120px] items-center gap-3">
                          <progress
                            value={project.progress}
                            max="100"
                            aria-label={`${project.name} progres ${formatPercent(project.progress)}`}
                            className="project-progress"
                          />
                          <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                            {formatPercent(project.progress)}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums">
                        {formatPercent(project.material)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                          {project.phase}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                        {project.finish}
                      </td>
                      <td className="px-4 py-4">
                        <HealthBadge health={project.health} />
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-4 text-right font-mono text-xs font-semibold tabular-nums ${project.gm < 22 ? 'text-red-700' : 'text-slate-700'}`}
                      >
                        {formatPercent(project.gm)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-200 md:hidden">
              {visibleProjects.map((project) => (
                <article
                  key={project.id}
                  className={`space-y-4 p-5 ${selectedProject === project.id ? 'bg-teal-50/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedProject(project.id)}
                      aria-pressed={selectedProject === project.id}
                      className={`min-w-0 rounded text-left ${focusClass}`}
                    >
                      <strong className="block break-words text-sm font-semibold leading-5 text-slate-800">
                        {project.name}
                      </strong>
                      <span className="mt-2 block text-xs text-slate-500">
                        {project.id} · {project.city}
                      </span>
                    </button>
                    <HealthBadge health={project.health} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Progres</p>
                      <p className="mt-1 font-mono font-semibold">
                        {formatPercent(project.progress)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Material</p>
                      <p className="mt-1 font-mono font-semibold">
                        {formatPercent(project.material)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fase</p>
                      <p className="mt-1 font-mono font-semibold">
                        {project.phase}
                      </p>
                    </div>
                  </div>
                  <progress
                    value={project.progress}
                    max="100"
                    aria-label={`${project.name} progres ${formatPercent(project.progress)}`}
                    className="project-progress"
                  />
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <p>
                      Target{' '}
                      <span className="font-medium text-slate-700">
                        {project.finish}
                      </span>
                    </p>
                    <p>
                      GM{' '}
                      <span className="font-mono font-semibold text-slate-700">
                        {formatPercent(project.gm)}
                      </span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
            <Filter className="size-7 text-slate-300" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-800">
              Tidak ada proyek yang cocok
            </h3>
            <p className="text-sm text-slate-500">
              Coba kata kunci atau kondisi proyek lain.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className={`rounded text-sm font-semibold text-teal-800 hover:underline ${focusClass}`}
            >
              Reset pencarian dan filter
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
