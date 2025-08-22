import { FileParseResult } from "@/types";
import { read, utils, WorkBook, ParsingOptions } from "xlsx";
import Papa from "papaparse";
import { expose } from "comlink";
import { checkIfExcel } from "@/lib/utils";

const MAX_FILE_SIZE_FOR_PROGRESSIVE_PARSING = 10 * 1024 * 1024;
const MAX_PARSING_BUFFER_SIZE = 32 * 1024;
const CHUNK_SIZES = [4 * 1024, 8 * 1024, 16 * 1024, 32 * 1024];

const PARSING_OPTIONS: ParsingOptions = {
  type: "array",
  bookSheets: true, // Only read sheet names
  bookProps: false, // Skip document properties
  bookVBA: false, // Skip VBA
  cellFormula: false, // Skip formulas
  cellHTML: false, // Skip HTML
  cellNF: false, // Skip number formats
  cellStyles: false, // Skip styles
  cellText: false, // Skip text
  cellDates: false, // Skip dates
  sheetStubs: false, // Skip empty cells
};

const api = {
  async getFileSheetNames(file: File): Promise<string[]> {
    // If the file is larger than 10MB, use progressive parsing
    if (file.size > MAX_FILE_SIZE_FOR_PROGRESSIVE_PARSING) {
      return getSheetNamesProgressive(file);
    }
    return getSheetNames(file);
  },
  async parseExcelBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    sheetNames?: string[]
  ): Promise<FileParseResult> {
    return parseExcelFromBuffer(buffer, fileName, sheetNames);
  },
  async parseFile(file: File, sheetNames?: string[]): Promise<FileParseResult> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      return parseCSV(file);
    } else if (checkIfExcel(name)) {
      return parseExcel(file, sheetNames);
    } else if (name.endsWith(".json")) {
      return parseJSON(file);
    }
    throw new Error(`Unsupported file type: ${name}`);
  },
};

async function parseCSV(file: File): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors.length > 0) {
          reject(
            new Error(
              `CSV parsing errors: ${results.errors
                .map(e => e.message)
                .join(", ")}`
            )
          );
          return;
        }

        const rows = results.data as Record<string, any>[];
        const headers = results.meta.fields || [];

        resolve({
          headers,
          rows,
          totalRows: rows.length,
          fileType: "csv",
        });
      },
      error: error => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

async function parseExcelFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  sheetNames?: string[]
): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    try {
      const workbook = read(new Uint8Array(buffer), { type: "array" });
      const { headers, rows, totalRows } = parseExcelSheet(
        workbook,
        sheetNames || workbook.SheetNames
      );
      resolve({
        headers,
        rows: rows as Record<string, any>[],
        totalRows,
        fileType: fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "xls",
      });
    } catch (error) {
      reject(
        new Error(
          `Excel parsing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      );
    }
  });
}

function parseExcelSheet(workBook: WorkBook, sheetNames: string[]) {
  // First pass: analyze all sheets to find the best header
  const sheetAnalysis = sheetNames
    .map(sheetName => {
      const worksheet = workBook.Sheets[sheetName];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) return null;

      const potentialHeaders = jsonData[0] as any[];
      const headerQuality = analyzeHeaderQuality(potentialHeaders);

      return {
        sheetName,
        headers: potentialHeaders,
        quality: headerQuality,
        data: jsonData.slice(1),
        rowCount: jsonData.length - 1,
      };
    })
    .filter(Boolean);

  if (sheetAnalysis.length === 0) {
    throw new Error("No valid sheets found");
  }

  // Find the sheet with the best header
  const bestSheet = sheetAnalysis.reduce((best, current) =>
    current?.quality && best?.quality && current.quality > best.quality
      ? current
      : best
  );

  // Use the best sheet's headers as master headers
  const masterHeaders = bestSheet?.headers;

  // Combine all sheets using the master headers
  const allRows: Record<string, any>[] = [];

  sheetAnalysis.forEach(sheet => {
    const rows = sheet?.data.map(row => {
      const obj: Record<string, any> = {};
      masterHeaders?.forEach((header, index) => {
        obj[header] = (row as any[])[index] || null;
      });
      return obj;
    });
    if (rows) {
      allRows.push(...rows);
    }
  });

  return {
    headers: masterHeaders || [], // Include sheet identifier
    rows: allRows,
    totalRows: allRows.length,
  };
}

function analyzeHeaderQuality(headers: any[]): number {
  if (!headers || headers.length === 0) return 0;

  let quality = 0;

  // Check for empty/null headers
  const nonEmptyHeaders = headers.filter(h => h && h.toString().trim() !== "");
  quality += nonEmptyHeaders.length * 2;

  // Check for duplicate headers
  const uniqueHeaders = new Set(
    nonEmptyHeaders.map(h => h.toString().toLowerCase())
  );
  quality += uniqueHeaders.size;

  // Penalize for empty headers
  quality -= (headers.length - nonEmptyHeaders.length) * 3;

  // Bonus for common header patterns (refined list)
  const commonHeaders = [
    // Core identifiers
    "id",
    "employeeid",
    "employee id",

    // Names (multiple variations)
    "firstname",
    "first name",
    "firstname",
    "givenname",
    "given name",
    "lastname",
    "last name",
    "surname",
    "familyname",
    "family name",

    // Contact info
    "email",
    "email address",
    "phone",
    "phone number",
    "mobile",
    "mobile number",
    "cell",
    "cellphone",

    // Work info
    "department",
    "division",
    "team",
    "position",
    "jobtitle",
    "job title",
    "role",

    // Location
    "country",
    "city",
    "region",
    "area",

    // Dates
    "startdate",
    "start date",
    "hiredate",
    "hire date",
    "birthdate",
    "date of birth",
    "dob",
  ];

  commonHeaders.forEach(common => {
    if (uniqueHeaders.has(common)) quality += 1;
  });

  return quality;
}

/**
 * Read the file in chunks to get the sheet names
 * If the first chunk fails, fall back to the full file
 * @param file - The file to read
 * @returns The sheet names
 */
async function getSheetNamesProgressive(file: File): Promise<string[]> {
  const stream = file.stream();
  const reader = stream.getReader();

  try {
    let buffer = new Uint8Array(0);
    let attemptCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append the new chunk to the buffer
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;

      // Try to parse every 4KB
      if (buffer.length >= CHUNK_SIZES[attemptCount]) {
        try {
          const workbook = read(buffer, PARSING_OPTIONS);

          if (workbook.SheetNames && workbook.SheetNames.length > 0) {
            reader.cancel();
            return workbook.SheetNames;
          }

          attemptCount++;
          continue;
        } catch {
          attemptCount++;
        }
      }

      // If the buffer is too large, cancel the reader
      if (buffer.length >= MAX_PARSING_BUFFER_SIZE) {
        reader.cancel();
        break;
      }
    }

    // Attempt the full buffer, if it fails, fall back to the full file
    try {
      const workbook = read(buffer, { type: "array", bookSheets: true });
      return workbook.SheetNames;
    } catch {
      return getSheetNames(file);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read the first 8KB of the file to get the sheet names
 * If the first chunk fails, fall back to the full file
 * @param file - The file to read
 * @returns The sheet names
 */
async function getSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Only read the first 8KB - enough for Excel metadata
    const chunk = file.slice(0, CHUNK_SIZES[1]);

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, PARSING_OPTIONS);
        resolve(workbook.SheetNames);
      } catch {
        // If chunk fails, fall back to full file
        reader.onload = e => {
          try {
            const fullData = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = read(fullData, {
              type: "array",
              bookSheets: true,
            });
            resolve(workbook.SheetNames);
          } catch {
            reject(new Error("Failed to read Excel file"));
          }
        };
        reader.readAsArrayBuffer(file);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsArrayBuffer(chunk);
  });
}

async function parseExcel(
  file: File,
  sheetNames?: string[]
): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const { headers, rows, totalRows } = parseExcelSheet(
          workbook,
          sheetNames || workbook.SheetNames
        );
        resolve({
          headers,
          rows: rows as Record<string, any>[],
          totalRows,
          fileType: file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "xls",
        });
      } catch (error) {
        reject(
          new Error(
            `Excel parsing failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          )
        );
      }
    };

    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsArrayBuffer(file);
  });
}

async function parseJSON(file: File): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          reject(new Error("JSON file must contain an array of objects"));
          return;
        }

        if (data.length === 0) {
          reject(new Error("JSON file is empty"));
          return;
        }

        const headers = Object.keys(data[0]);
        const rows = data as Record<string, any>[];

        resolve({
          headers,
          rows,
          totalRows: rows.length,
          fileType: "json",
        });
      } catch (error) {
        reject(
          new Error(
            `JSON parsing failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          )
        );
      }
    };

    reader.onerror = () => reject(new Error("Failed to read JSON file"));
    reader.readAsText(file);
  });
}

expose(api);
