export const materialStatuses = [
  'PLANNED',
  'ORDERED',
  'PARTIAL',
  'RECEIVED',
  'INSTALLED',
  'SHORTAGE',
] as const;

export type MaterialStatusValue = (typeof materialStatuses)[number];

export type MaterialRecord = {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  boqItemNo: string | null;
  code: string | null;
  description: string;
  unit: string;
  requiredQty: string;
  orderedQty: string;
  receivedQty: string;
  installedQty: string;
  supplier: string | null;
  purchaseOrderNo: string | null;
  needByDate: string | null;
  estimatedArrival: string | null;
  status: MaterialStatusValue;
  isActive: boolean;
  updatedAt: string;
  canEdit: boolean;
};

export type MaterialWorkspaceData = {
  demoMode: boolean;
  materials: MaterialRecord[];
  metrics: {
    active: number;
    shortage: number;
    lateEta: number;
    readinessPct: number;
  };
};

export type MaterialActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialMaterialActionState: MaterialActionState = {
  status: 'idle',
  message: '',
};
