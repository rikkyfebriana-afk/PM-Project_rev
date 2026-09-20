export const BOQ_ALLOWED_EXTENSIONS = ['.xlsx', '.csv'] as const;

export const BOQ_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_BOQ_IMPORT_ROWS = 1_000;

export const boqStatuses = ['DRAFT', 'APPROVED', 'SUPERSEDED'] as const;
export const boqItemTypes = ['MATERIAL', 'SERVICE', 'OTHER'] as const;

export type BoqStatusValue = (typeof boqStatuses)[number];
export type BoqItemTypeValue = (typeof boqItemTypes)[number];

export type BoqImportField =
  | 'projectId'
  | 'fileName'
  | 'sheetName'
  | 'itemNo'
  | 'itemCode'
  | 'itemType'
  | 'description'
  | 'unit'
  | 'quantity'
  | 'unitPrice'
  | 'rows';

export type BoqImportRowInput = {
  itemNo: string;
  itemCode: string | null;
  itemType: BoqItemTypeValue;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type BoqImportPayload = {
  projectId: string;
  fileName: string;
  sheetName: string;
  rows: BoqImportRowInput[];
};

export type BoqImportCommitRequest = {
  projectId: string;
  documentId: string;
  sheetName: string;
};

export type BoqImportIssue = {
  /** One-based position in the normalized payload. Omitted for import metadata. */
  row?: number;
  field: BoqImportField;
  message: string;
};

export type BoqImportResult = {
  id: string;
  version: number;
  itemCount: number;
  totalValue: string;
};

export type BoqImportActionState =
  | {
      status: 'success' | 'duplicate';
      message: string;
      boq: BoqImportResult;
    }
  | {
      status: 'error';
      message: string;
      issues?: BoqImportIssue[];
    };

export type BoqApprovalResult = {
  id: string;
  version: number;
  createdMaterials: number;
  updatedMaterials: number;
  deactivatedMaterials: number;
};

export type BoqApprovalActionState =
  | {
      status: 'success';
      message: string;
      approval: BoqApprovalResult;
    }
  | {
      status: 'conflict' | 'error';
      message: string;
      issues?: string[];
    };

export type BoqApprovalPayload = {
  boqId: string;
  expectedApprovedBoqId: string | null;
};

export type BoqWorkspaceProject = {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  canEdit: boolean;
};

export type BoqWorkspaceRevision = {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  version: number;
  status: BoqStatusValue;
  sourceFileName: string | null;
  sourceSheetName: string | null;
  itemCount: number;
  totalValue: string;
  createdAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
};

export type BoqWorkspaceData = {
  demoMode: boolean;
  canApprove: boolean;
  projects: BoqWorkspaceProject[];
  boqs: BoqWorkspaceRevision[];
  metrics: {
    versions: number;
    approved: number;
    drafts: number;
    items: number;
    totalValue: string;
  };
};
