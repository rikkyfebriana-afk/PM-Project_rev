export const materialOrderStatuses = [
  'DRAFT',
  'ORDERED',
  'PARTIAL',
  'RECEIVED',
  'CANCELLED',
] as const;
export type MaterialOrderStatusValue = (typeof materialOrderStatuses)[number];
export const activeMaterialOrderStatuses = [
  'DRAFT',
  'ORDERED',
  'PARTIAL',
] as const;

export type OrderStockRow = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  minQty: string;
  openQty: string;
  belowMinimum: boolean;
  openOrderId: string | null;
};

export type MaterialOrderRow = {
  id: string;
  warehouseItemId: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  receivedQty: string;
  remainingQty: string;
  supplier: string;
  referenceNo: string;
  expectedArrival: string | null;
  status: MaterialOrderStatusValue;
  notes: string;
  cancellationReason: string | null;
  createdByName: string;
  updatedAt: string;
  createdAt: string;
};

export type MaterialOrderWorkspaceData = {
  demoMode: boolean;
  today: string;
  items: OrderStockRow[];
  orders: MaterialOrderRow[];
  metrics: {
    lowStock: number;
    openOrders: number;
    lateOrders: number;
    receivedOrders: number;
  };
};
