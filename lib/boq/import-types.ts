import type { BoqImportRowInput } from './types.ts';

export type BoqImportField =
  | 'itemNo'
  | 'itemCode'
  | 'itemType'
  | 'description'
  | 'unit'
  | 'quantity'
  | 'unitPrice';

export type BoqColumnMap = Record<BoqImportField, number | null>;

export type BoqImportIssue = {
  code:
    | 'FILE_TYPE'
    | 'FILE_SIZE'
    | 'EMPTY_WORKBOOK'
    | 'EMPTY_SHEET'
    | 'FILE_SIGNATURE'
    | 'ZIP_LIMIT'
    | 'FORMULA_INPUT'
    | 'HIDDEN_DATA'
    | 'MERGED_DATA'
    | 'HEADER_NOT_FOUND'
    | 'DUPLICATE_COLUMN'
    | 'MISSING_COLUMN'
    | 'ROW_LIMIT'
    | 'EMPTY_VALUE'
    | 'INVALID_NUMBER'
    | 'AMBIGUOUS_NUMBER'
    | 'NEGATIVE_NUMBER'
    | 'TOO_MANY_DECIMALS'
    | 'DUPLICATE_ITEM_NO'
    | 'DUPLICATE_ITEM_CODE'
    | 'INVALID_ITEM_TYPE'
    | 'ROW_SKIPPED';
  severity: 'error' | 'warning';
  message: string;
  sourceRow?: number;
  field?: BoqImportField;
};

export type BoqImportPreviewRow = BoqImportRowInput & {
  sourceRow: number;
  lineTotal: string;
  issues: BoqImportIssue[];
};

export type BoqParsedWorkbook = {
  fileName: string;
  fileSize: number;
  sheetName: string;
  sheetNames: string[];
  headerRow: number | null;
  columnMap: BoqColumnMap;
  rows: BoqImportPreviewRow[];
  issues: BoqImportIssue[];
  validRowCount: number;
  errorRowCount: number;
  warningRowCount: number;
  totalValue: string;
};
