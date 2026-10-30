export type WarehouseItemRow = {
  id: string;
  code: string;
  normalizedCode: string;
  description: string;
  unit: string;
  location: string;
  minQty: string;
  quantity: string;
  lowStock: boolean;
};

export type WarehouseMaterialOption = {
  id: string;
  projectId: string;
  projectLabel: string;
  itemNo: string;
  boqVersion: number;
  code: string;
  normalizedCode: string;
  description: string;
  unit: string;
  requiredQty: string;
  receivedQty: string;
  installedQty: string;
  warehouseIssuedQty: string;
  remainingQty: string;
};

export type WarehouseMovementRow = {
  id: string;
  type: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  balanceAfter: string;
  referenceNo: string;
  recipient: string;
  notes: string;
  actor: string;
  projectLabel: string | null;
  boqLabel: string | null;
  createdAt: string;
};

export type WarehouseReturnOption = {
  id: string;
  itemCode: string;
  unit: string;
  projectLabel: string;
  referenceNo: string;
  recipient: string;
  issuedQty: string;
  returnedQty: string;
  returnableQty: string;
  createdAt: string;
};

export type WarehouseWorkspaceData = {
  demoMode: boolean;
  items: WarehouseItemRow[];
  materials: WarehouseMaterialOption[];
  movements: WarehouseMovementRow[];
  returnableIssues: WarehouseReturnOption[];
  returnSearch: string;
  metrics: { items: number; lowStock: number; emptyStock: number; movements: number };
};
