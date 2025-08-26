export interface User {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  startDate: string; // YYYY-MM-DD
  department: string;
  division: string;
  position: string;
  region: string;
  mobileNumber: string;
  workPhoneNumber?: string;
  gender: string;
  country: string; // ISO-3166-1 alpha-3
  city: string;
  dateOfBirth: string; // YYYY-MM-DD
  language: string;
}

export interface UserFieldMapping {
  [sourceColumn: string]: keyof User;
}

export interface FileParseResult {
  headers: string[];
  sheetNames?: string[];
  rows: Record<string, any>[];
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
