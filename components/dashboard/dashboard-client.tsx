'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Download,
  Filter,
  MoreHorizontal,
  PackageCheck,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectMap } from '@/components/map/project-map';
import { buildCsv } from '@/lib/csv';
import type {
  DashboardData,
  DashboardHealthFilter,
  DashboardProject,
} from '@/lib/dashboard/types';

function filterProjects(
  projects: DashboardProject[],
  query: string,
  health: DashboardHealthFilter,
) {
  const needle = query.trim().toLowerCase();
  return projects.filter((project) => {
    const matchesText =
      !needle ||
      [project.id, project.name, project.city, project.phase].some((value) =>
        value.toLowerCase().includes(needle),
      );
    return matchesText && (health === 'All' || project.health === health);
  });
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
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
    const csv = buildCsv([header, ...rows]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'project-portfolio.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 xl:p-9 lg:pb-9">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#83909c]" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search projects"
          placeholder="Search project, city, or phase..."
          className="h-11 border-[#dce2e6] bg-white pl-9 text-xs shadow-none"
        />
      </div>
      <section aria-labelledby="portfolio-heading">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="section-kicker">Portfolio pulse</p>
            <h2 id="portfolio-heading" className="section-title">
              Current project health
            </h2>
          </div>
          <p className="hidden text-[11px] text-[#7c8994] sm:block">
            {data.demoMode ? 'Demo snapshot' : 'Live PostgreSQL data'}
          </p>
        </div>
        <div className="grid overflow-hidden border border-[#dde3e7] bg-white sm:grid-cols-2 xl:grid-cols-5">
          {portfolioStatus.map((item, index) => (
            <article
              key={item.label}
              className={`status-card relative p-5 ${index > 0 ? 'xl:border-l xl:border-[#e5e9ec]' : ''}`}
            >
              <span className={`status-accent status-${item.tone}`} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#74828d]">
                    {item.label}
                  </p>
                  <p className="mt-3 font-mono text-[29px] font-semibold leading-none tracking-[-0.04em] text-[#132738]">
                    {item.value}
                  </p>
                </div>
                <span className={`status-dot dot-${item.tone}`} />
              </div>
              <p className="mt-3 text-[11px] text-[#8a969f]">{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-heading">
        <div className="mb-3">
          <p className="section-kicker">Commercial overview</p>
          <h2 id="commercial-heading" className="section-title">
            Financial position
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden border border-[#183446] bg-[#183446] sm:grid-cols-2 xl:grid-cols-5">
          {finance.map((item) => (
            <article key={item.label} className="bg-[#163044] p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/46">
                {item.label}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-mono text-[23px] font-semibold tracking-[-0.04em]">
                  {item.value}
                </p>
                <span
                  className={
                    item.direction === 'up'
                      ? 'text-[#6bd0b4]'
                      : item.direction === 'down'
                        ? 'text-[#ff8b76]'
                        : 'text-white/50'
                  }
                >
                  {item.direction === 'up'
                    ? '↗'
                    : item.direction === 'down'
                      ? '↘'
                      : '•'}
                </span>
              </div>
              <p
                className={`mt-2 text-[10px] ${item.direction === 'up' ? 'text-[#6bd0b4]' : item.direction === 'down' ? 'text-[#ff8b76]' : 'text-white/45'}`}
              >
                {item.change}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]">
        <article className="border border-[#dde3e7] bg-white">
          <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4 md:px-6">
            <div>
              <p className="section-kicker">Live footprint</p>
              <h2 className="section-title">Project location map</h2>
            </div>
            <Link
              href="/projects"
              className="text-[11px] font-semibold text-[#d85832] hover:underline"
            >
              View all locations
            </Link>
          </div>
          <ProjectMap
            projects={mapProjects}
            onSelect={(projectId) => {
              const project = projects.find((item) => item.id === projectId);
              setSearchTerm(project?.city ?? '');
              setSelectedProject(projectId);
              document
                .getElementById('portfolio-table')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </article>

        <article className="border border-[#dde3e7] bg-white">
          <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4">
            <div>
              <p className="section-kicker text-[#d85832]!">Priority queue</p>
              <h2 className="section-title">Action required</h2>
            </div>
            <div className="grid size-9 place-items-center bg-[#fff0eb] text-[#d85832]">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="divide-y divide-[#edf0f2]">
            {alerts.map((alert) => (
              <button
                key={alert.title}
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setHealthFilter(
                    alert.tone === 'red' ? 'Critical' : 'Attention',
                  );
                }}
                className="group flex w-full items-center gap-3 px-5 py-[17px] text-left transition hover:bg-[#f8fafb]"
              >
                <span
                  className={`h-8 w-1 shrink-0 ${alert.tone === 'red' ? 'bg-[#e35645]' : 'bg-[#e4a23a]'}`}
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[12px] font-semibold text-[#263746]">
                    {alert.title}
                  </strong>
                  <small className="mt-1 block text-[10px] text-[#8b969f]">
                    {alert.detail}
                  </small>
                </span>
                <span
                  className={`grid size-8 place-items-center rounded-full font-mono text-xs font-bold ${alert.tone === 'red' ? 'bg-[#fff0ed] text-[#d94f3e]' : 'bg-[#fff7e8] text-[#c98825]'}`}
                >
                  {alert.count}
                </span>
                <span className="text-[#9ba5ad] transition group-hover:translate-x-0.5">
                  ›
                </span>
              </button>
            ))}
          </div>
          <div className="m-5 flex items-center gap-3 bg-[#f1f5f6] p-3 text-[10px] text-[#687681]">
            <Clock3 className="size-4 text-[#17364a]" />
            <span>5 items have been open for more than 48 hours.</span>
          </div>
        </article>
      </section>

      <section
        aria-labelledby="milestone-heading"
        className="border border-[#dde3e7] bg-white"
      >
        <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4 md:px-6">
          <div>
            <p className="section-kicker">Next 30 days</p>
            <h2 id="milestone-heading" className="section-title">
              Upcoming milestones
            </h2>
          </div>
          <div className="hidden items-center gap-2 text-[10px] font-medium text-[#74818b] sm:flex">
            <CalendarDays className="size-3.5" /> 4 key dates
          </div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4">
          {milestones.map((milestone, index) => (
            <article
              key={milestone.label}
              className={`group relative flex min-h-[118px] items-center gap-4 p-5 md:p-6 ${index > 0 ? 'xl:border-l xl:border-[#e6eaed]' : ''} ${index > 1 ? 'md:border-t xl:border-t-0' : ''}`}
            >
              <div
                className={`grid size-14 shrink-0 place-items-center border text-center ${milestone.state === 'risk' ? 'border-[#f0c8bf] bg-[#fff4f1] text-[#ce5638]' : 'border-[#dce3e7] bg-[#f4f7f8] text-[#17364a]'}`}
              >
                <span>
                  <strong className="block font-mono text-lg leading-none">
                    {milestone.day}
                  </strong>
                  <small className="mt-1 block text-[8px] font-bold uppercase tracking-[0.15em]">
                    {milestone.month}
                  </small>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="truncate text-[12px] font-semibold text-[#253846]">
                    {milestone.label}
                  </h3>
                  {milestone.state === 'risk' && (
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[#d85832]" />
                  )}
                </div>
                <p className="mt-2 truncate text-[10px] text-[#87939c]">
                  {milestone.meta}
                </p>
                <p
                  className={`mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] ${milestone.state === 'risk' ? 'text-[#d85832]' : 'text-[#1a8970]'}`}
                >
                  {milestone.state === 'risk' ? 'At risk' : 'On schedule'}
                </p>
              </div>
              <ArrowUpRight className="size-4 text-[#b1bac0] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#17364a]" />
            </article>
          ))}
        </div>
      </section>

      <section
        id="portfolio-table"
        aria-labelledby="project-table-heading"
        className="border border-[#d9e0e4] bg-white"
      >
        <div className="flex flex-col gap-4 border-b border-[#e5e9ec] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6">
          <div>
            <p className="section-kicker">Delivery register</p>
            <h2 id="project-table-heading" className="section-title">
              Project portfolio
            </h2>
            <p className="mt-2 text-[10px] text-[#87939c]">
              Showing {visibleProjects.length} of {projects.length} priority
              projects
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center border border-[#dce2e6] bg-[#f7f9fa] p-1"
              aria-label="Filter by health"
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
                  className={`px-3 py-1.5 text-[10px] font-semibold transition ${healthFilter === filter ? 'bg-[#17364a] text-white shadow-sm' : 'text-[#6f7d87] hover:text-[#17364a]'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportPortfolio}
              className="h-9 border-[#dce2e6] px-3 text-[10px] shadow-none"
            >
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        </div>

        {selectedProject && (
          <div className="flex items-center justify-between gap-4 border-b border-[#dce6ea] bg-[#f1f6f7] px-5 py-3 text-[10px] text-[#586b78] md:px-6">
            <span>
              <strong className="text-[#18384b]">Selected:</strong>{' '}
              {projects.find((project) => project.id === selectedProject)?.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="font-semibold text-[#cf5938] hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}

        {visibleProjects.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e6eaed] bg-[#f7f9fa] text-[9px] font-bold uppercase tracking-[0.13em] text-[#7b8993]">
                    <th className="px-6 py-3.5 font-bold">Project</th>
                    <th className="px-4 py-3.5 font-bold">Progress</th>
                    <th className="px-4 py-3.5 font-bold">Material</th>
                    <th className="px-4 py-3.5 font-bold">Phase</th>
                    <th className="px-4 py-3.5 font-bold">Finish</th>
                    <th className="px-4 py-3.5 font-bold">Health</th>
                    <th className="px-4 py-3.5 text-right font-bold">GM</th>
                    <th className="w-12 px-4 py-3.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f2]">
                  {visibleProjects.map((project) => (
                    <tr
                      key={project.id}
                      className={`group transition hover:bg-[#f8fafb] ${selectedProject === project.id ? 'bg-[#f1f6f7]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedProject(project.id)}
                          className="text-left"
                        >
                          <strong className="block text-[12px] font-semibold text-[#263846] group-hover:text-[#d85832]">
                            {project.name}
                          </strong>
                          <span className="mt-1 block font-mono text-[9px] text-[#8b979f]">
                            {project.id} · {project.city}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[104px] items-center gap-3">
                          <progress
                            value={project.progress}
                            max="100"
                            aria-label={`${project.name} progress ${formatPercent(project.progress)}`}
                            className="project-progress"
                          />
                          <span className="w-8 font-mono text-[10px] font-semibold text-[#3d505d]">
                            {formatPercent(project.progress)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-[#3d505d]">
                          <PackageCheck
                            className={`size-3.5 ${project.material < 80 ? 'text-[#d7962f]' : 'text-[#1b8e75]'}`}
                          />
                          {formatPercent(project.material)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="bg-[#edf2f4] px-2 py-1 font-mono text-[9px] font-bold text-[#49606d]">
                          {project.phase}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[10px] text-[#536672]">
                        {project.finish}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold ${project.health === 'On track' ? 'bg-[#eaf6f2] text-[#197a65]' : project.health === 'Attention' ? 'bg-[#fff5e3] text-[#b77719]' : 'bg-[#fff0ed] text-[#cf4e3c]'}`}
                        >
                          <i
                            className={`size-1.5 rounded-full ${project.health === 'On track' ? 'bg-[#1c9377]' : project.health === 'Attention' ? 'bg-[#e4a23a]' : 'bg-[#e35645]'}`}
                          />
                          {project.health}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-mono text-[11px] font-semibold ${project.gm < 22 ? 'text-[#d14f3c]' : 'text-[#2b4656]'}`}
                      >
                        {formatPercent(project.gm)}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          aria-label={`More actions for ${project.name}`}
                          className="grid size-7 place-items-center text-[#8d989f] hover:bg-[#e9eef1] hover:text-[#18384b]"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#e9edef] md:hidden">
              {visibleProjects.map((project) => (
                <article
                  key={project.id}
                  className={`p-5 ${selectedProject === project.id ? 'bg-[#f1f6f7]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProject(project.id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <span>
                      <strong className="block text-[12px] font-semibold text-[#263846]">
                        {project.name}
                      </strong>
                      <small className="mt-1 block font-mono text-[9px] text-[#8b979f]">
                        {project.id} · {project.city}
                      </small>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold ${project.health === 'On track' ? 'bg-[#eaf6f2] text-[#197a65]' : project.health === 'Attention' ? 'bg-[#fff5e3] text-[#b77719]' : 'bg-[#fff0ed] text-[#cf4e3c]'}`}
                    >
                      {project.health}
                    </span>
                  </button>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-[9px] text-[#81909a]">
                    <div>
                      <span className="block uppercase tracking-wider">
                        Progress
                      </span>
                      <strong className="mt-1 block font-mono text-[11px] text-[#314856]">
                        {formatPercent(project.progress)}
                      </strong>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider">
                        Material
                      </span>
                      <strong className="mt-1 block font-mono text-[11px] text-[#314856]">
                        {formatPercent(project.material)}
                      </strong>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider">GM</span>
                      <strong className="mt-1 block font-mono text-[11px] text-[#314856]">
                        {formatPercent(project.gm)}
                      </strong>
                    </div>
                  </div>
                  <progress
                    value={project.progress}
                    max="100"
                    aria-label={`${project.name} progress ${formatPercent(project.progress)}`}
                    className="project-progress mt-4"
                  />
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
            <div>
              <div className="mx-auto grid size-11 place-items-center bg-[#eef2f4] text-[#647783]">
                <Filter className="size-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#263846]">
                No projects found
              </h3>
              <p className="mt-2 text-[11px] text-[#87939c]">
                Try another keyword or reset the health filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setHealthFilter('All');
                }}
                className="mt-4 text-[10px] font-semibold text-[#d85832] hover:underline"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
