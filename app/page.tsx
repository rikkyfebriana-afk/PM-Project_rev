'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleGauge,
  Clock3,
  Download,
  Filter,
  LayoutDashboard,
  Map,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const portfolioStatus = [
  { label: 'Active', value: '18', note: 'All live projects', tone: 'navy' },
  { label: 'On track', value: '12', note: '67% of portfolio', tone: 'green' },
  { label: 'Attention', value: '3', note: 'Needs follow-up', tone: 'amber' },
  { label: 'Critical', value: '3', note: 'Immediate action', tone: 'red' },
  { label: 'Closed', value: '5', note: 'This quarter', tone: 'slate' },
];

const finance = [
  { label: 'PO Value', value: 'Rp12.5B', change: '+8.2%', direction: 'up' },
  { label: 'Budget', value: 'Rp8.7B', change: '69.6% of PO', direction: 'flat' },
  { label: 'Actual', value: 'Rp6.1B', change: '70.1% used', direction: 'flat' },
  { label: 'Forecast', value: 'Rp8.4B', change: 'Rp300M under', direction: 'up' },
  { label: 'Margin', value: '32.8%', change: '+1.4 pts', direction: 'up' },
];

const alerts = [
  { title: 'Material shortage', count: 12, detail: '4 projects impacted', tone: 'red' },
  { title: 'Delayed project', count: 2, detail: 'Avg. 8 days behind', tone: 'red' },
  { title: 'FAT punch list', count: 3, detail: '18 items remaining', tone: 'amber' },
  { title: 'Budget risk', count: 2, detail: 'Forecast over 95%', tone: 'amber' },
];

const mapProjects = [
  { city: 'Cirebon', project: 'Substation Upgrade', x: '53%', y: '37%', tone: 'green' },
  { city: 'Bogor', project: 'Control Panel', x: '34%', y: '62%', tone: 'amber' },
  { city: 'Bekasi', project: 'Switchgear Revamp', x: '43%', y: '51%', tone: 'red' },
  { city: 'Surabaya', project: 'Plant Automation', x: '76%', y: '67%', tone: 'green' },
];

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Projects', icon: BriefcaseBusiness },
  { label: 'Map view', icon: Map },
  { label: 'Resources', icon: Users },
  { label: 'Reports', icon: CircleGauge },
];

const milestones = [
  { day: '18', month: 'Sep', label: 'FAT Cirebon', meta: 'PT Nusantara Grid', state: 'upcoming' },
  { day: '22', month: 'Sep', label: 'Delivery Bogor', meta: 'Control Panel', state: 'upcoming' },
  { day: '25', month: 'Sep', label: 'Installation Bekasi', meta: 'Switchgear Revamp', state: 'risk' },
  { day: '30', month: 'Sep', label: 'BAST Cirebon', meta: 'Final handover', state: 'upcoming' },
];

type Health = 'On track' | 'Attention' | 'Critical';
type HealthFilter = 'All' | Health;

const projects = [
  { id: 'PCC-024', name: 'Cirebon Substation', city: 'Cirebon', progress: 72, material: 92, phase: 'PROD', finish: '30 Sep', health: 'On track' as Health, gm: 28 },
  { id: 'PCC-031', name: 'Bogor Control Panel', city: 'Bogor', progress: 58, material: 74, phase: 'PROC', finish: '15 Oct', health: 'Attention' as Health, gm: 24 },
  { id: 'PCC-018', name: 'Bekasi Switchgear', city: 'Bekasi', progress: 81, material: 100, phase: 'FAT', finish: '25 Sep', health: 'Critical' as Health, gm: 19 },
  { id: 'PCC-029', name: 'Surabaya Automation', city: 'Surabaya', progress: 66, material: 88, phase: 'PROD', finish: '22 Oct', health: 'On track' as Health, gm: 31 },
  { id: 'PCC-035', name: 'Karawang MCC Upgrade', city: 'Karawang', progress: 43, material: 65, phase: 'ENG', finish: '08 Nov', health: 'Attention' as Health, gm: 26 },
  { id: 'PCC-012', name: 'Semarang Protection', city: 'Semarang', progress: 91, material: 100, phase: 'INST', finish: '20 Sep', health: 'On track' as Health, gm: 34 },
];

function filterProjects(query: string, health: HealthFilter) {
  const needle = query.trim().toLowerCase();
  return projects.filter((project) => {
    const matchesText = !needle || [project.id, project.name, project.city, project.phase].some((value) => value.toLowerCase().includes(needle));
    return matchesText && (health === 'All' || project.health === health);
  });
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

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('All');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const visibleProjects = useMemo(() => filterProjects(searchTerm, healthFilter), [searchTerm, healthFilter]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContextApi }).modelContext;
    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();
    const registration = modelContext.registerTool(
      {
        name: 'filter_project_portfolio',
        title: 'Filter project portfolio',
        description: 'Filter the visible project portfolio by a search query and health status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Project name, ID, city, or phase.' },
            health: { type: 'string', enum: ['All', 'On track', 'Attention', 'Critical'] },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (typeof input !== 'object' || input === null) throw new Error('Input must be an object.');
          const values = input as Record<string, unknown>;
          const query = values.query === undefined ? '' : values.query;
          const health = values.health === undefined ? 'All' : values.health;
          if (typeof query !== 'string') throw new Error('Query must be a string.');
          if (!['All', 'On track', 'Attention', 'Critical'].includes(String(health))) throw new Error('Health filter is invalid.');
          const safeHealth = health as HealthFilter;
          const matches = filterProjects(query, safeHealth);
          setSearchTerm(query);
          setHealthFilter(safeHealth);
          return { query, health: safeHealth, matchingCount: matches.length, projectIds: matches.map((project) => project.id) };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function exportPortfolio() {
    const header = ['ID', 'Project', 'City', 'Progress', 'Material', 'Phase', 'Finish', 'Health', 'GM'];
    const rows = visibleProjects.map((project) => [project.id, project.name, project.city, `${project.progress}%`, `${project.material}%`, project.phase, project.finish, project.health, `${project.gm}%`]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'project-portfolio.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-[#172536]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[226px] flex-col bg-[#102334] text-white lg:flex">
        <div className="flex h-[82px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid size-10 place-items-center bg-[#f36b3e] font-mono text-sm font-bold tracking-tight text-white">PC</div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight">Project Control</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">Operations center</p>
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Workspace</p>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium transition ${active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}>
              <Icon className={`size-4 ${active ? 'text-[#ff7b4f]' : 'text-white/45 group-hover:text-white/75'}`} />
              {label}
              {active && <span className="ml-auto h-4 w-0.5 bg-[#f36b3e]" />}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-[13px] text-white/55 hover:text-white"><Settings className="size-4" /> Settings</button>
          <div className="mt-2 flex items-center gap-3 border border-white/10 bg-white/5 p-3">
            <div className="grid size-9 place-items-center bg-[#dce6ea] text-xs font-bold text-[#153246]">AP</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Andi Pratama</p>
              <p className="truncate text-[10px] text-white/40">Project Manager</p>
            </div>
            <ChevronDown className="size-3.5 text-white/40" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[226px]">
        <header className="sticky top-0 z-20 flex h-[82px] items-center gap-4 border-b border-[#dfe4e8] bg-white/95 px-4 backdrop-blur md:px-7 xl:px-9">
          <div className="lg:hidden"><div className="grid size-9 place-items-center bg-[#102334] font-mono text-xs font-bold text-white">PC</div></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#83909c]">Tuesday, 08 September 2026</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em] text-[#132738] md:text-xl">Project Control Center</h1>
          </div>
          <div className="relative hidden w-full max-w-[310px] md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#83909c]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label="Search projects" placeholder="Search project, city, or phase..." className="h-10 border-[#dce2e6] bg-[#f7f8f9] pl-9 text-xs shadow-none focus-visible:border-[#183b4f] focus-visible:ring-2 focus-visible:ring-[#183b4f]/10" />
          </div>
          <Button aria-label="Notifications" variant="outline" size="icon-lg" className="relative border-[#dce2e6] bg-white shadow-none">
            <Bell className="size-[17px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e35645] ring-2 ring-white" />
          </Button>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 xl:p-9 lg:pb-9">
          <div className="relative md:hidden">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#83909c]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label="Search projects" placeholder="Search project, city, or phase..." className="h-11 border-[#dce2e6] bg-white pl-9 text-xs shadow-none" />
          </div>
          <section aria-labelledby="portfolio-heading">
            <div className="mb-3 flex items-end justify-between">
              <div><p className="section-kicker">Portfolio pulse</p><h2 id="portfolio-heading" className="section-title">Current project health</h2></div>
              <p className="hidden text-[11px] text-[#7c8994] sm:block">Last synced 2 minutes ago</p>
            </div>
            <div className="grid overflow-hidden border border-[#dde3e7] bg-white sm:grid-cols-2 xl:grid-cols-5">
              {portfolioStatus.map((item, index) => (
                <article key={item.label} className={`status-card relative p-5 ${index > 0 ? 'xl:border-l xl:border-[#e5e9ec]' : ''}`}>
                  <span className={`status-accent status-${item.tone}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#74828d]">{item.label}</p><p className="mt-3 font-mono text-[29px] font-semibold leading-none tracking-[-0.04em] text-[#132738]">{item.value}</p></div>
                    <span className={`status-dot dot-${item.tone}`} />
                  </div>
                  <p className="mt-3 text-[11px] text-[#8a969f]">{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="commercial-heading">
            <div className="mb-3"><p className="section-kicker">Commercial overview</p><h2 id="commercial-heading" className="section-title">Financial position</h2></div>
            <div className="grid gap-px overflow-hidden border border-[#183446] bg-[#183446] sm:grid-cols-2 xl:grid-cols-5">
              {finance.map((item) => (
                <article key={item.label} className="bg-[#163044] p-5 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/46">{item.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3"><p className="font-mono text-[23px] font-semibold tracking-[-0.04em]">{item.value}</p><span className={item.direction === 'up' ? 'text-[#6bd0b4]' : 'text-white/50'}>{item.direction === 'up' ? '↗' : '•'}</span></div>
                  <p className={`mt-2 text-[10px] ${item.direction === 'up' ? 'text-[#6bd0b4]' : 'text-white/45'}`}>{item.change}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]">
            <article className="border border-[#dde3e7] bg-white">
              <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4 md:px-6">
                <div><p className="section-kicker">Live footprint</p><h2 className="section-title">Project location map</h2></div>
                <button type="button" className="text-[11px] font-semibold text-[#d85832] hover:underline">View all locations</button>
              </div>
              <div className="map-stage relative h-[320px] overflow-hidden md:h-[370px]">
                <div className="absolute left-5 top-5 z-10 flex gap-2 bg-white/92 p-1.5 shadow-sm ring-1 ring-[#dbe1e5] backdrop-blur">
                  <button type="button" className="bg-[#17364a] px-3 py-1.5 text-[10px] font-semibold text-white">Projects</button>
                  <button type="button" className="px-3 py-1.5 text-[10px] font-semibold text-[#73818c]">Regions</button>
                </div>
                <div className="map-route map-route-one" /><div className="map-route map-route-two" />
                {mapProjects.map((project) => (
                  <button key={project.city} type="button" onClick={() => { setSearchTerm(project.city); setSelectedProject(projects.find((item) => item.city === project.city)?.id ?? null); }} style={{ left: project.x, top: project.y }} className="map-pin group" aria-label={`${project.city}: ${project.project}`}>
                    <span className={`map-pin-core pin-${project.tone}`}><MapPin className="size-3.5" /></span>
                    <span className="map-label"><strong>{project.city}</strong><small>{project.project}</small></span>
                  </button>
                ))}
                <div className="absolute bottom-4 left-5 flex items-center gap-4 bg-white/90 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#687680] ring-1 ring-[#dde3e7]">
                  <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[#1c9377]" /> On track</span>
                  <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[#e4a23a]" /> Attention</span>
                  <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[#e35645]" /> Critical</span>
                </div>
              </div>
            </article>

            <article className="border border-[#dde3e7] bg-white">
              <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4">
                <div><p className="section-kicker text-[#d85832]!">Priority queue</p><h2 className="section-title">Action required</h2></div>
                <div className="grid size-9 place-items-center bg-[#fff0eb] text-[#d85832]"><AlertTriangle className="size-4" /></div>
              </div>
              <div className="divide-y divide-[#edf0f2]">
                {alerts.map((alert) => (
                  <button key={alert.title} type="button" onClick={() => { setSearchTerm(''); setHealthFilter(alert.tone === 'red' ? 'Critical' : 'Attention'); }} className="group flex w-full items-center gap-3 px-5 py-[17px] text-left transition hover:bg-[#f8fafb]">
                    <span className={`h-8 w-1 shrink-0 ${alert.tone === 'red' ? 'bg-[#e35645]' : 'bg-[#e4a23a]'}`} />
                    <span className="min-w-0 flex-1"><strong className="block truncate text-[12px] font-semibold text-[#263746]">{alert.title}</strong><small className="mt-1 block text-[10px] text-[#8b969f]">{alert.detail}</small></span>
                    <span className={`grid size-8 place-items-center rounded-full font-mono text-xs font-bold ${alert.tone === 'red' ? 'bg-[#fff0ed] text-[#d94f3e]' : 'bg-[#fff7e8] text-[#c98825]'}`}>{alert.count}</span>
                    <span className="text-[#9ba5ad] transition group-hover:translate-x-0.5">›</span>
                  </button>
                ))}
              </div>
              <div className="m-5 flex items-center gap-3 bg-[#f1f5f6] p-3 text-[10px] text-[#687681]"><Clock3 className="size-4 text-[#17364a]" /><span>5 items have been open for more than 48 hours.</span></div>
            </article>
          </section>

          <section aria-labelledby="milestone-heading" className="border border-[#dde3e7] bg-white">
            <div className="flex items-start justify-between border-b border-[#e5e9ec] px-5 py-4 md:px-6">
              <div><p className="section-kicker">Next 30 days</p><h2 id="milestone-heading" className="section-title">Upcoming milestones</h2></div>
              <div className="hidden items-center gap-2 text-[10px] font-medium text-[#74818b] sm:flex"><CalendarDays className="size-3.5" /> 4 key dates</div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-4">
              {milestones.map((milestone, index) => (
                <article key={milestone.label} className={`group relative flex min-h-[118px] items-center gap-4 p-5 md:p-6 ${index > 0 ? 'xl:border-l xl:border-[#e6eaed]' : ''} ${index > 1 ? 'md:border-t xl:border-t-0' : ''}`}>
                  <div className={`grid size-14 shrink-0 place-items-center border text-center ${milestone.state === 'risk' ? 'border-[#f0c8bf] bg-[#fff4f1] text-[#ce5638]' : 'border-[#dce3e7] bg-[#f4f7f8] text-[#17364a]'}`}>
                    <span><strong className="block font-mono text-lg leading-none">{milestone.day}</strong><small className="mt-1 block text-[8px] font-bold uppercase tracking-[0.15em]">{milestone.month}</small></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2"><h3 className="truncate text-[12px] font-semibold text-[#253846]">{milestone.label}</h3>{milestone.state === 'risk' && <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[#d85832]" />}</div>
                    <p className="mt-2 truncate text-[10px] text-[#87939c]">{milestone.meta}</p>
                    <p className={`mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] ${milestone.state === 'risk' ? 'text-[#d85832]' : 'text-[#1a8970]'}`}>{milestone.state === 'risk' ? 'At risk' : 'On schedule'}</p>
                  </div>
                  <ArrowUpRight className="size-4 text-[#b1bac0] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#17364a]" />
                </article>
              ))}
            </div>
          </section>

          <section id="portfolio-table" aria-labelledby="project-table-heading" className="border border-[#d9e0e4] bg-white">
            <div className="flex flex-col gap-4 border-b border-[#e5e9ec] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6">
              <div>
                <p className="section-kicker">Delivery register</p>
                <h2 id="project-table-heading" className="section-title">Project portfolio</h2>
                <p className="mt-2 text-[10px] text-[#87939c]">Showing {visibleProjects.length} of {projects.length} priority projects</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-[#dce2e6] bg-[#f7f9fa] p-1" aria-label="Filter by health">
                  {(['All', 'On track', 'Attention', 'Critical'] as HealthFilter[]).map((filter) => (
                    <button key={filter} type="button" onClick={() => setHealthFilter(filter)} aria-pressed={healthFilter === filter} className={`px-3 py-1.5 text-[10px] font-semibold transition ${healthFilter === filter ? 'bg-[#17364a] text-white shadow-sm' : 'text-[#6f7d87] hover:text-[#17364a]'}`}>{filter}</button>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={exportPortfolio} className="h-9 border-[#dce2e6] px-3 text-[10px] shadow-none"><Download className="size-3.5" /> Export</Button>
              </div>
            </div>

            {selectedProject && (
              <div className="flex items-center justify-between gap-4 border-b border-[#dce6ea] bg-[#f1f6f7] px-5 py-3 text-[10px] text-[#586b78] md:px-6">
                <span><strong className="text-[#18384b]">Selected:</strong> {projects.find((project) => project.id === selectedProject)?.name}</span>
                <button type="button" onClick={() => setSelectedProject(null)} className="font-semibold text-[#cf5938] hover:underline">Clear selection</button>
              </div>
            )}

            {visibleProjects.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[880px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e6eaed] bg-[#f7f9fa] text-[9px] font-bold uppercase tracking-[0.13em] text-[#7b8993]">
                        <th className="px-6 py-3.5 font-bold">Project</th><th className="px-4 py-3.5 font-bold">Progress</th><th className="px-4 py-3.5 font-bold">Material</th><th className="px-4 py-3.5 font-bold">Phase</th><th className="px-4 py-3.5 font-bold">Finish</th><th className="px-4 py-3.5 font-bold">Health</th><th className="px-4 py-3.5 text-right font-bold">GM</th><th className="w-12 px-4 py-3.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf0f2]">
                      {visibleProjects.map((project) => (
                        <tr key={project.id} className={`group transition hover:bg-[#f8fafb] ${selectedProject === project.id ? 'bg-[#f1f6f7]' : ''}`}>
                          <td className="px-6 py-4"><button type="button" onClick={() => setSelectedProject(project.id)} className="text-left"><strong className="block text-[12px] font-semibold text-[#263846] group-hover:text-[#d85832]">{project.name}</strong><span className="mt-1 block font-mono text-[9px] text-[#8b979f]">{project.id} · {project.city}</span></button></td>
                          <td className="px-4 py-4"><div className="flex min-w-[104px] items-center gap-3"><progress value={project.progress} max="100" aria-label={`${project.name} progress ${project.progress}%`} className="project-progress" /><span className="w-8 font-mono text-[10px] font-semibold text-[#3d505d]">{project.progress}%</span></div></td>
                          <td className="px-4 py-4"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#3d505d]"><PackageCheck className={`size-3.5 ${project.material < 80 ? 'text-[#d7962f]' : 'text-[#1b8e75]'}`} />{project.material}%</div></td>
                          <td className="px-4 py-4"><span className="bg-[#edf2f4] px-2 py-1 font-mono text-[9px] font-bold text-[#49606d]">{project.phase}</span></td>
                          <td className="px-4 py-4 font-mono text-[10px] text-[#536672]">{project.finish}</td>
                          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold ${project.health === 'On track' ? 'bg-[#eaf6f2] text-[#197a65]' : project.health === 'Attention' ? 'bg-[#fff5e3] text-[#b77719]' : 'bg-[#fff0ed] text-[#cf4e3c]'}`}><i className={`size-1.5 rounded-full ${project.health === 'On track' ? 'bg-[#1c9377]' : project.health === 'Attention' ? 'bg-[#e4a23a]' : 'bg-[#e35645]'}`} />{project.health}</span></td>
                          <td className={`px-4 py-4 text-right font-mono text-[11px] font-semibold ${project.gm < 22 ? 'text-[#d14f3c]' : 'text-[#2b4656]'}`}>{project.gm}%</td>
                          <td className="px-4 py-4"><button type="button" aria-label={`More actions for ${project.name}`} className="grid size-7 place-items-center text-[#8d989f] hover:bg-[#e9eef1] hover:text-[#18384b]"><MoreHorizontal className="size-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-[#e9edef] md:hidden">
                  {visibleProjects.map((project) => (
                    <article key={project.id} className={`p-5 ${selectedProject === project.id ? 'bg-[#f1f6f7]' : ''}`}>
                      <button type="button" onClick={() => setSelectedProject(project.id)} className="flex w-full items-start justify-between gap-3 text-left">
                        <span><strong className="block text-[12px] font-semibold text-[#263846]">{project.name}</strong><small className="mt-1 block font-mono text-[9px] text-[#8b979f]">{project.id} · {project.city}</small></span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold ${project.health === 'On track' ? 'bg-[#eaf6f2] text-[#197a65]' : project.health === 'Attention' ? 'bg-[#fff5e3] text-[#b77719]' : 'bg-[#fff0ed] text-[#cf4e3c]'}`}>{project.health}</span>
                      </button>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-[9px] text-[#81909a]"><div><span className="block uppercase tracking-wider">Progress</span><strong className="mt-1 block font-mono text-[11px] text-[#314856]">{project.progress}%</strong></div><div><span className="block uppercase tracking-wider">Material</span><strong className="mt-1 block font-mono text-[11px] text-[#314856]">{project.material}%</strong></div><div><span className="block uppercase tracking-wider">GM</span><strong className="mt-1 block font-mono text-[11px] text-[#314856]">{project.gm}%</strong></div></div>
                      <progress value={project.progress} max="100" aria-label={`${project.name} progress ${project.progress}%`} className="project-progress mt-4" />
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
                <div><div className="mx-auto grid size-11 place-items-center bg-[#eef2f4] text-[#647783]"><Filter className="size-4" /></div><h3 className="mt-4 text-sm font-semibold text-[#263846]">No projects found</h3><p className="mt-2 text-[11px] text-[#87939c]">Try another keyword or reset the health filter.</p><button type="button" onClick={() => { setSearchTerm(''); setHealthFilter('All'); }} className="mt-4 text-[10px] font-semibold text-[#d85832] hover:underline">Reset filters</button></div>
              </div>
            )}
          </section>
        </main>

        <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#dce2e6] bg-white/96 px-2 py-2 backdrop-blur lg:hidden">
          {navItems.slice(0, 4).map(({ label, icon: Icon, active }) => <button key={label} type="button" className={`flex flex-col items-center gap-1 py-1 text-[8px] font-semibold ${active ? 'text-[#d85832]' : 'text-[#7d8b95]'}`}><Icon className="size-4" />{label}</button>)}
        </nav>
      </div>
    </div>
  );
}
