'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  FolderKanban,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { ProjectForm } from '@/components/projects/project-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { buildCsv } from '@/lib/csv';
import {
  formatProjectDate,
  formatRupiahShort,
  grossMargin,
  healthLabels,
  phaseLabels,
  statusLabels,
} from '@/lib/projects/presentation';
import {
  projectHealthValues,
  projectPhases,
  projectStatuses,
  type ProjectHealthValue,
  type ProjectPhaseValue,
  type ProjectRegisterData,
  type ProjectStatusValue,
} from '@/lib/projects/types';

type ProjectRegisterProps = { data: ProjectRegisterData };
type FilterValue<T extends string> = 'ALL' | T;

function HealthBadge({ health }: { health: ProjectHealthValue }) {
  const styles = {
    ON_TRACK: 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]',
    ATTENTION: 'border-[#efd7a8] bg-[#fff8e9] text-[#a96d15]',
    CRITICAL: 'border-[#efc4bd] bg-[#fff1ee] text-[#c44735]',
  }[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${styles}`}
    >
      <span className="size-1.5 rounded-full bg-current" />{' '}
      {healthLabels[health]}
    </span>
  );
}

export function ProjectRegister({ data }: ProjectRegisterProps) {
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<FilterValue<ProjectHealthValue>>('ALL');
  const [status, setStatus] = useState<FilterValue<ProjectStatusValue>>('ALL');
  const [phase, setPhase] = useState<FilterValue<ProjectPhaseValue>>('ALL');
  const [editorProjectId, setEditorProjectId] = useState<string | 'NEW' | null>(
    null,
  );
  const closeEditor = useCallback(() => setEditorProjectId(null), []);
  const editorProject =
    editorProjectId && editorProjectId !== 'NEW'
      ? (data.projects.find((project) => project.id === editorProjectId) ??
        null)
      : null;

  useEffect(() => {
    if (!editorProjectId) return;
    const editor = document.getElementById('project-editor');
    editor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor?.focus({ preventScroll: true });
  }, [editorProjectId]);

  const visibleProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.projects.filter((project) => {
      const matchesSearch =
        !needle ||
        [
          project.code,
          project.name,
          project.clientName,
          project.address,
          project.projectManagerName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle));
      return (
        matchesSearch &&
        (health === 'ALL' || project.health === health) &&
        (status === 'ALL' || project.status === status) &&
        (phase === 'ALL' || project.phase === phase)
      );
    });
  }, [data.projects, health, phase, search, status]);

  function exportProjects() {
    const rows = [
      [
        'Code',
        'Project',
        'Client',
        'Status',
        'Health',
        'Phase',
        'Progress',
        'PO Value',
        'Budget',
        'Actual',
        'Forecast',
        'Manager',
        'Finish',
      ],
      ...visibleProjects.map((project) => [
        project.code,
        project.name,
        project.clientName ?? '',
        statusLabels[project.status],
        healthLabels[project.health],
        phaseLabels[project.phase],
        `${project.progressPct}%`,
        project.poValue,
        project.budgetValue,
        project.actualCost,
        project.forecastCost,
        project.projectManagerName ?? '',
        project.plannedFinish ?? '',
      ]),
    ];
    const csv = buildCsv(rows);
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'project-register.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const critical = data.projects.filter(
    (project) => project.status === 'ACTIVE' && project.health === 'CRITICAL',
  ).length;

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 xl:p-9 lg:pb-9">
      <section className="border border-[#dce2e6] bg-white p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="section-kicker text-[#d85832]!">Portfolio register</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#172d3e] md:text-3xl">
              Projects
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6e7e88]">
              Kelola identitas, PIC, fase, kesehatan, nilai kontrak, jadwal, dan
              lokasi seluruh project.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportProjects}
              className="h-10 rounded-none border-[#d7e0e4] px-4"
            >
              <Download /> Export CSV
            </Button>
            {data.permissions.canCreate && (
              <Button
                type="button"
                onClick={() => setEditorProjectId('NEW')}
                className="h-10 rounded-none bg-[#d85832] px-4 text-white hover:bg-[#bd4727]"
              >
                <Plus /> New project
              </Button>
            )}
          </div>
        </div>
        {data.demoMode && (
          <div className="mt-5 flex items-start gap-3 border border-[#ecd6b1] bg-[#fff9ee] px-4 py-3 text-xs leading-5 text-[#8e6224]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Preview
            menggunakan data demo read-only. Data live akan muncul setelah
            PostgreSQL dan migration dikonfigurasi.
          </div>
        )}
      </section>

      {editorProjectId && (
        <ProjectForm
          key={editorProjectId}
          project={editorProject}
          managers={data.managers}
          canAssignManager={data.permissions.canAssignManager}
          canArchive={data.permissions.canArchive}
          demoMode={data.demoMode}
          onClose={closeEditor}
        />
      )}

      <section className="grid overflow-hidden border border-[#dce2e6] bg-white sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Active projects',
            value: data.metrics.active,
            note: `${data.projects.length} accessible records`,
            tone: 'bg-[#17364a]',
          },
          {
            label: 'Needs attention',
            value: data.metrics.needsAttention,
            note: 'Attention + critical',
            tone: 'bg-[#e4a23a]',
          },
          {
            label: 'Critical',
            value: critical,
            note: 'Immediate intervention',
            tone: 'bg-[#e35645]',
          },
          {
            label: 'Active PO value',
            value: formatRupiahShort(data.metrics.poValue),
            note: 'Current accessible portfolio',
            tone: 'bg-[#1c9377]',
          },
        ].map((metric, index) => (
          <article
            key={metric.label}
            className={`relative min-h-32 p-5 ${index ? 'xl:border-l xl:border-[#e5e9ec]' : ''}`}
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${metric.tone}`} />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d8b95]">
              {metric.label}
            </p>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.05em] text-[#17364a]">
              {metric.value}
            </p>
            <p className="mt-2 text-[11px] text-[#88949c]">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="border border-[#dce2e6] bg-white">
        <div className="border-b border-[#e5e9ec] p-5 md:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#84919a]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, project, client, location, or manager…"
                aria-label="Search projects"
                className="h-10 rounded-none border-[#dce2e6] pl-9"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:flex">
              <NativeSelect
                aria-label="Filter health"
                className="w-full xl:w-40"
                value={health}
                onChange={(event) =>
                  setHealth(
                    event.target.value as FilterValue<ProjectHealthValue>,
                  )
                }
              >
                <NativeSelectOption value="ALL">All health</NativeSelectOption>
                {projectHealthValues.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {healthLabels[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Filter status"
                className="w-full xl:w-40"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as FilterValue<ProjectStatusValue>,
                  )
                }
              >
                <NativeSelectOption value="ALL">All status</NativeSelectOption>
                {projectStatuses.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {statusLabels[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Filter phase"
                className="w-full xl:w-44"
                value={phase}
                onChange={(event) =>
                  setPhase(event.target.value as FilterValue<ProjectPhaseValue>)
                }
              >
                <NativeSelectOption value="ALL">All phases</NativeSelectOption>
                {projectPhases.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {phaseLabels[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[#87939c]">
            Showing {visibleProjects.length} of {data.projects.length} projects
          </p>
        </div>

        {visibleProjects.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead className="bg-[#f6f8f9] text-[9px] font-bold uppercase tracking-[0.14em] text-[#7c8993]">
                  <tr>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Health</th>
                    <th className="px-4 py-3">Phase</th>
                    <th className="px-4 py-3">Commercial</th>
                    <th className="px-4 py-3">Finish</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9edef]">
                  {visibleProjects.map((project) => {
                    const margin = grossMargin(
                      project.poValue,
                      project.forecastCost,
                    );
                    return (
                      <tr
                        key={project.id}
                        className="align-middle transition hover:bg-[#f8fafb]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center bg-[#edf2f4] text-[#31566b]">
                              <FolderKanban className="size-4" />
                            </span>
                            <span>
                              <strong className="block text-xs text-[#243847]">
                                {project.name}
                              </strong>
                              <small className="mt-1 block font-mono text-[10px] text-[#8a969f]">
                                {project.code} ·{' '}
                                {project.clientName ?? 'No client'}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex w-28 items-center gap-2">
                            <progress
                              className="project-progress"
                              value={project.progressPct}
                              max="100"
                            />
                            <span className="font-mono text-[10px] font-semibold text-[#3c5361]">
                              {project.progressPct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <HealthBadge health={project.health} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#455c69]">
                            {phaseLabels[project.phase]}
                          </span>
                          <small className="mt-1 block text-[9px] text-[#8d989f]">
                            {statusLabels[project.status]}
                          </small>
                        </td>
                        <td className="px-4 py-4">
                          <strong className="block font-mono text-[11px] text-[#2b4554]">
                            {formatRupiahShort(project.poValue)}
                          </strong>
                          <small className="mt-1 block text-[9px] text-[#82909a]">
                            GM {margin === null ? '—' : `${margin.toFixed(1)}%`}
                          </small>
                        </td>
                        <td className="px-4 py-4 text-[10px] font-medium text-[#526672]">
                          {formatProjectDate(project.plannedFinish)}
                        </td>
                        <td className="px-4 py-4">
                          <strong className="block max-w-32 truncate text-[10px] font-semibold text-[#3f5664]">
                            {project.projectManagerName ?? 'Unassigned'}
                          </strong>
                          <small className="mt-1 block text-[9px] text-[#8d989f]">
                            {project.membersCount} members ·{' '}
                            {project.actionsCount} open
                          </small>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {project.canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditorProjectId(project.id)}
                              disabled={data.demoMode}
                              className="rounded-none"
                            >
                              <Edit3 /> Edit
                            </Button>
                          ) : (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#9aa5ac]">
                              Read only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#e8edef] lg:hidden">
              {visibleProjects.map((project) => (
                <article key={project.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85832]">
                        {project.code}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-[#263a48]">
                        {project.name}
                      </h3>
                      <p className="mt-1 text-[10px] text-[#87949d]">
                        {project.clientName ?? 'No client assigned'}
                      </p>
                    </div>
                    <HealthBadge health={project.health} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <progress
                      className="project-progress"
                      value={project.progressPct}
                      max="100"
                    />
                    <span className="font-mono text-xs font-semibold text-[#304b5a]">
                      {project.progressPct}%
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 bg-[#f6f8f9] p-3 text-[10px]">
                    <div>
                      <span className="text-[#8a969f]">Phase</span>
                      <strong className="mt-1 block text-[#405866]">
                        {phaseLabels[project.phase]}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8a969f]">PO value</span>
                      <strong className="mt-1 block font-mono text-[#405866]">
                        {formatRupiahShort(project.poValue)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8a969f]">Finish</span>
                      <strong className="mt-1 block text-[#405866]">
                        {formatProjectDate(project.plannedFinish)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8a969f]">Manager</span>
                      <strong className="mt-1 block truncate text-[#405866]">
                        {project.projectManagerName ?? 'Unassigned'}
                      </strong>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-[#7b8992]">
                      <MapPin className="size-3.5 shrink-0" />{' '}
                      {project.address ?? 'Location not set'}
                    </span>
                    {project.canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditorProjectId(project.id)}
                        disabled={data.demoMode}
                      >
                        <Edit3 /> Edit
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center bg-[#eef2f4] text-[#607684]">
                <Search className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#263a48]">
                No projects found
              </h3>
              <p className="mt-2 text-xs text-[#85929b]">
                Ubah kata kunci atau reset seluruh filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setHealth('ALL');
                  setStatus('ALL');
                  setPhase('ALL');
                }}
                className="mt-4 text-xs font-semibold text-[#d85832] hover:underline"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3 border border-[#dce2e6] bg-white p-4 text-xs text-[#627581]">
          <Users className="size-4 text-[#1b8b73]" /> Member-based visibility is
          active.
        </div>
        <div className="flex items-center gap-3 border border-[#dce2e6] bg-white p-4 text-xs text-[#627581]">
          <AlertTriangle className="size-4 text-[#d9942f]" /> Health labels
          include text and color.
        </div>
        <div className="flex items-center gap-3 border border-[#dce2e6] bg-white p-4 text-xs text-[#627581]">
          <MapPin className="size-4 text-[#d85832]" />{' '}
          {data.projects.filter((project) => project.latitude !== null).length}{' '}
          projects have map coordinates.
        </div>
      </section>
    </main>
  );
}
