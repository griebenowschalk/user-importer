import type { rowHooks } from "../validation/schema";

export const USER_KEYS = [
  "employeeId",
  "firstName",
  "lastName",
  "email",
  "startDate",
  "department",
  "division",
  "position",
  "region",
  "mobileNumber",
  "workPhoneNumber",
  "gender",
  "country",
  "city",
  "dateOfBirth",
  "language",
] as const;

export type User = {
  [K in (typeof USER_KEYS)[number]]: K extends "workPhoneNumber"
    ? string | undefined
    : string;
};

export interface UserFieldMapping {
  [sourceColumn: string]: keyof User;
}

export interface FileParseResult {
  headers: string[];
  sheetNames?: string[];
  rows: Record<string, any>[]; // Raw untransformed rows (now stores original data)
  totalRows: number;
  fileType: "csv" | "xls" | "xlsx" | "json";
  columnMapping: {
    mapped: Record<string, keyof User>; // "empId" → "employeeId"
    unmapped: string[]; // ["workCell", "unknownField"]
    allMappings: Record<string, string | null>; // "empId" → "employeeId", "workCell" → null
  };
}

export interface ValidationError {
  row: number;
  field: keyof User;
  message: string;
  value: any;
}

export interface ImportResult {
  imported: number;
  failed: number;
  skipped: number;
  errors: ValidationError[];
  batchResults: BatchResult[];
}

export interface BatchResult {
  batchId: string;
  success: boolean;
  count: number;
  errors?: ValidationError[];
}

export enum CleaningChangeType {
  trimmed = "trimmed",
  caseChanged = "caseChanged",
  normalized = "normalized",
  customHook = "customHook",
  rowHook = "rowHook",
}

export type Complexity = "low" | "medium" | "high";
export type TrimType = "both" | "left" | "right" | "normalizeSpaces";
export type CaseType = "lower" | "upper" | "none";
export type ColumnType =
  | "id"
  | "string"
  | "email"
  | "date"
  | "phone"
  | "category"
  | "country";
export enum ActionType {
  find = "find",
  replaceAll = "replaceAll",
}

export type RowData = Record<string, unknown>;

export type ColumnHook = (
  value: unknown,
  context: { field: string; row: RowData }
) => unknown;
export type RowHook = (
  row: RowData,
  cleanUp?: boolean
) => [RowData, { field: string; message: string }[]];

export interface CleaningRule {
  type: ColumnType;
  trim?: TrimType;
  case?: CaseType;
  normalize?: {
    phoneDigitsOnly?: boolean;
    toISODate?: boolean;
    toISO3?: boolean;
    toEmployeeId?: boolean;
  };
  columnHookId?: string;
  options?: Record<string, unknown>;
  regex?: RegExp;
  unique?: {
    ignoreCase?: boolean;
    ignoreNulls?: boolean;
  };
}

// Performance metadata
export interface ValidationMetadata {
  totalRows: number;
  processedRows: number;
  errorCount: number;
  changeCount: number;
  estimatedTimeRemaining: number;
}

// Cleaning changes tracking
export interface CleaningChange {
  row: number;
  field: keyof User;
  originalValue: unknown;
  cleanedValue: unknown;
  changeType: CleaningChangeType[];
  description: string;
}

export interface CleaningResult {
  rows: Record<string, unknown>[];
  errors: ValidationError[];
  changes: CleaningChange[];
}

// Validation chunks for streaming
export interface ValidationChunk extends CleaningResult {
  startRow: number;
  endRow: number;
}

// Overall validation progress
export interface ValidationProgress {
  chunks: ValidationChunk[];
  metadata: ValidationMetadata;
  isComplete: boolean;
  groupedErrors?: GroupedRowError[];
  groupedChanges?: GroupedRowChange[];
}

// Grouped error structures for better display
export interface GroupedFieldError {
  field: string;
  messages: string[];
  value: unknown;
}

export interface GroupedRowError {
  row: number;
  fields: GroupedFieldError[];
}

export interface GroupedFieldChange {
  field: string;
  messages: string[];
  value: unknown;
}

export interface GroupedRowChange {
  row: number;
  fields: GroupedFieldChange[];
}

// Compiled config for performance
export interface CompiledConfig {
  bySourceHeader: Map<
    string,
    {
      target: keyof User;
      rule: CleaningRule;
      optionSet?: Set<string>;
      regex?: RegExp;
      validators: Array<(value: unknown) => string | null>;
    }
  >;
  rowHooks: typeof rowHooks;
  // Performance flags
  hasUniquenessChecks: boolean;
}

// Pipeline options
export interface PipelineOptions {
  chunkSize?: number;
  batchSize?: number;
  onProgress: (progress: ValidationProgress) => void;
  enableStreaming?: boolean;
  strategy?: "immediate" | "streaming" | "worker";
}

export type TableState = CleaningResult & {
  groupedErrors: GroupedRowError[];
  groupedChanges: GroupedRowChange[];
};

export type HistoryEntry = {
  label: string;
  prev: TableState;
  next: TableState;
};

export interface DataPreviewProps {
  fileData: FileParseResult;
  mappings: Record<string, keyof User>;
  onNext: (validatedData: { valid: any[]; errors: ValidationError[] }) => void;
  onBack: () => void;
}

export type HighlightCell = {
  rowIndex: number;
  colId: string;
};
