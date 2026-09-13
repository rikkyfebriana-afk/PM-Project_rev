export const projectStatuses = [
  'ACTIVE',
  'ON_HOLD',
  'CLOSED',
  'CANCELLED',
] as const;

export const projectHealthValues = [
  'ON_TRACK',
  'ATTENTION',
  'CRITICAL',
] as const;

export const projectPhases = [
  'PLANNING',
  'ENGINEERING',
  'PROCUREMENT',
  'PRODUCTION',
  'FAT',
  'DELIVERY',
  'INSTALLATION',
  'BAST',
  'CLOSED',
] as const;

export type ProjectStatusValue = (typeof projectStatuses)[number];
export type ProjectHealthValue = (typeof projectHealthValues)[number];
export type ProjectPhaseValue = (typeof projectPhases)[number];

export type ProjectManagerOption = {
  id: string;
  displayName: string;
  username: string;
};

export type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  status: ProjectStatusValue;
  health: ProjectHealthValue;
  phase: ProjectPhaseValue;
  progressPct: number;
  poValue: string;
  budgetValue: string;
  actualCost: string;
  forecastCost: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualFinish: string | null;
  projectManagerId: string | null;
  projectManagerName: string | null;
  membersCount: number;
  materialsCount: number;
  documentsCount: number;
  actionsCount: number;
  updatedAt: string;
  canEdit: boolean;
};

export type ProjectRegisterData = {
  projects: ProjectRecord[];
  managers: ProjectManagerOption[];
  metrics: {
    active: number;
    needsAttention: number;
    poValue: string;
  };
  demoMode: boolean;
  permissions: {
    canCreate: boolean;
    canAssignManager: boolean;
    canArchive: boolean;
    canEdit: boolean;
  };
};
