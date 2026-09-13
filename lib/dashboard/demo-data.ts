import type { DashboardData, DashboardHealth } from '@/lib/dashboard/types';
import { formatRupiahShort, grossMargin } from '@/lib/projects/presentation';
import { demoProjects } from '@/lib/projects/demo-data';

const materialReadiness: Record<string, number> = {
  'PCC-024': 92,
  'PCC-031': 74,
  'PCC-018': 100,
  'PCC-029': 88,
  'PCC-035': 65,
  'PCC-012': 100,
};

const phaseShort: Record<string, string> = {
  PLANNING: 'PLAN',
  ENGINEERING: 'ENG',
  PROCUREMENT: 'PROC',
  PRODUCTION: 'PROD',
  FAT: 'FAT',
  DELIVERY: 'DLV',
  INSTALLATION: 'INST',
  BAST: 'BAST',
  CLOSED: 'CLS',
};

const healthLabel: Record<string, DashboardHealth> = {
  ON_TRACK: 'On track',
  ATTENTION: 'Attention',
  CRITICAL: 'Critical',
};

function sum(field: 'poValue' | 'budgetValue' | 'actualCost' | 'forecastCost') {
  return demoProjects.reduce(
    (total, project) => total + Number(project[field]),
    0,
  );
}

const poValue = sum('poValue');
const budget = sum('budgetValue');
const actual = sum('actualCost');
const forecast = sum('forecastCost');
const margin = poValue ? ((poValue - forecast) / poValue) * 100 : 0;

export const demoDashboardData: DashboardData = {
  demoMode: true,
  portfolioStatus: [
    {
      label: 'Active',
      value: String(
        demoProjects.filter((project) => project.status === 'ACTIVE').length,
      ),
      note: 'All live projects',
      tone: 'navy',
    },
    {
      label: 'On track',
      value: String(
        demoProjects.filter(
          (project) =>
            project.status === 'ACTIVE' && project.health === 'ON_TRACK',
        ).length,
      ),
      note: 'Healthy delivery',
      tone: 'green',
    },
    {
      label: 'Attention',
      value: String(
        demoProjects.filter(
          (project) =>
            project.status === 'ACTIVE' && project.health === 'ATTENTION',
        ).length,
      ),
      note: 'Needs follow-up',
      tone: 'amber',
    },
    {
      label: 'Critical',
      value: String(
        demoProjects.filter(
          (project) =>
            project.status === 'ACTIVE' && project.health === 'CRITICAL',
        ).length,
      ),
      note: 'Immediate action',
      tone: 'red',
    },
    {
      label: 'Closed',
      value: String(
        demoProjects.filter((project) => project.status === 'CLOSED').length,
      ),
      note: 'Accessible records',
      tone: 'slate',
    },
  ],
  finance: [
    {
      label: 'PO Value',
      value: formatRupiahShort(poValue),
      change: 'Active portfolio',
      direction: 'flat',
    },
    {
      label: 'Budget',
      value: formatRupiahShort(budget),
      change: `${((budget / poValue) * 100).toFixed(1)}% of PO`,
      direction: 'flat',
    },
    {
      label: 'Actual',
      value: formatRupiahShort(actual),
      change: `${((actual / budget) * 100).toFixed(1)}% used`,
      direction: 'flat',
    },
    {
      label: 'Forecast',
      value: formatRupiahShort(forecast),
      change: `${formatRupiahShort(Math.abs(budget - forecast))} ${forecast <= budget ? 'under' : 'over'}`,
      direction: forecast <= budget ? 'up' : 'down',
    },
    {
      label: 'Margin',
      value: `${margin.toFixed(1)}%`,
      change: 'Forecast gross margin',
      direction: margin >= 0 ? 'up' : 'down',
    },
  ],
  alerts: [
    {
      title: 'Material shortage',
      count: 12,
      detail: '4 projects impacted',
      tone: 'red',
    },
    {
      title: 'Delayed project',
      count: 2,
      detail: 'Avg. 8 days behind',
      tone: 'red',
    },
    {
      title: 'FAT punch list',
      count: 3,
      detail: '18 items remaining',
      tone: 'amber',
    },
    {
      title: 'Budget risk',
      count: 2,
      detail: 'Forecast over 95%',
      tone: 'amber',
    },
  ],
  mapProjects: demoProjects
    .filter(
      (project) => project.latitude !== null && project.longitude !== null,
    )
    .slice(0, 4)
    .map((project) => ({
      id: project.code,
      city: project.address?.split(',')[0] ?? project.name,
      project: project.name,
      latitude: project.latitude!,
      longitude: project.longitude!,
      tone:
        project.health === 'CRITICAL'
          ? 'red'
          : project.health === 'ATTENTION'
            ? 'amber'
            : 'green',
    })),
  milestones: [
    {
      day: '18',
      month: 'Sep',
      label: 'FAT Cirebon',
      meta: 'PT Nusantara Grid',
      state: 'upcoming',
    },
    {
      day: '22',
      month: 'Sep',
      label: 'Delivery Bogor',
      meta: 'Control Panel',
      state: 'upcoming',
    },
    {
      day: '25',
      month: 'Sep',
      label: 'Installation Bekasi',
      meta: 'Switchgear Revamp',
      state: 'risk',
    },
    {
      day: '30',
      month: 'Sep',
      label: 'BAST Cirebon',
      meta: 'Final handover',
      state: 'upcoming',
    },
  ],
  projects: demoProjects.map((project) => ({
    id: project.code,
    name: project.name,
    city: project.address?.split(',')[0] ?? '—',
    progress: project.progressPct,
    material: materialReadiness[project.code] ?? 0,
    phase: phaseShort[project.phase] ?? project.phase,
    finish: project.plannedFinish
      ? new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${project.plannedFinish}T00:00:00.000Z`))
      : '—',
    health: healthLabel[project.health],
    gm: grossMargin(project.poValue, project.forecastCost) ?? 0,
  })),
};
