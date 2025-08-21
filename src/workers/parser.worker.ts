import { FileParseResult } from "@/types";
import { read, utils } from "xlsx";
import Papa from "papaparse";
import { expose } from "comlink";

const api = {
  async parseExcelBuffer(
    buffer: ArrayBuffer,
    fileName: string
  ): Promise<FileParseResult> {
    return parseExcelFromBuffer(buffer, fileName);
  },
  async parseFile(file: File): Promise<FileParseResult> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      return parseCSV(file);
    } else if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
      return parseExcel(file);
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
  fileName: string
): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    try {
      const workbook = read(new Uint8Array(buffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        reject(new Error("Excel file is empty"));
        return;
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1).map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          obj[header] = (row as any[])[index];
        });
        return obj;
      });

      resolve({
        headers,
        rows,
        totalRows: rows.length,
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

async function parseExcel(file: File): Promise<FileParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          reject(new Error("Excel file is empty"));
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = (row as any[])[index];
          });
          return obj;
        });

        resolve({
          headers,
          rows,
          totalRows: rows.length,
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
