export type DashboardHealth = 'On track' | 'Attention' | 'Critical';
export type DashboardHealthFilter = 'All' | DashboardHealth;

export type DashboardProject = {
  id: string;
  name: string;
  city: string;
  progress: number;
  material: number;
  phase: string;
  finish: string;
  health: DashboardHealth;
  gm: number;
};

export type DashboardData = {
  demoMode: boolean;
  portfolioStatus: Array<{
    label: string;
    value: string;
    note: string;
    tone: 'navy' | 'green' | 'amber' | 'red' | 'slate';
  }>;
  finance: Array<{
    label: string;
    value: string;
    change: string;
    direction: 'up' | 'flat' | 'down';
  }>;
  alerts: Array<{
    title: string;
    count: number;
    detail: string;
    tone: 'red' | 'amber';
  }>;
  mapProjects: Array<{
    id: string;
    city: string;
    project: string;
    latitude: number;
    longitude: number;
    tone: 'green' | 'amber' | 'red';
  }>;
  milestones: Array<{
    day: string;
    month: string;
    label: string;
    meta: string;
    state: 'upcoming' | 'risk';
  }>;
  projects: DashboardProject[];
};
