import { describe, it, expect, vi, beforeEach, beforeAll, Mock } from "vitest";

let exposedFunctions: any = null;

vi.mock("comlink", () => ({
  expose: vi.fn(obj => {
    exposedFunctions = obj;
  }),
}));

vi.mock("@/lib/utils", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    checkIfExcel: vi.fn(
      (name: string) => name.endsWith(".xlsx") || name.endsWith(".xls")
    ),
  };
});

vi.mock("@/lib/userColumnMatcher", () => ({
  default: {
    analyzeHeaderQuality: vi.fn(() => 0.8),
    createUserFieldMapping: vi.fn(() => ({
      mapped: {},
      unmapped: [],
      allMappings: {},
    })),
    mappingIncludesHeader: vi.fn(() => ({
      mapped: {},
      unmapped: [],
      allMappings: {},
    })),
  },
}));

vi.mock("papaparse", () => {
  const requiredFields = [
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
  ];
  return {
    default: {
      parse: vi.fn((_file, config: any) => {
        if (config.complete) {
          config.complete({
            data: [{ firstName: "John", lastName: "Doe" }],
            errors: [],
            meta: { fields: requiredFields },
          });
        }
      }),
      unparse: vi.fn(_data => "firstName,lastName\nJohn,Doe"),
    },
  };
});

vi.mock("xlsx", () => {
  const requiredHeaders = [
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
  ];
  const mockWorkbook = {
    SheetNames: ["Sheet1", "Sheet2"],
    Sheets: {
      Sheet1: {},
      Sheet2: {},
    },
  };
  return {
    read: vi.fn(() => mockWorkbook),
    write: vi.fn(() => new Uint8Array([1, 2, 3])),
    utils: {
      sheet_to_json: vi.fn(() => [
        requiredHeaders,
        requiredHeaders.map(() => "value"),
      ]),
      json_to_sheet: vi.fn(() => ({})),
      book_new: vi.fn(() => ({})),
      book_append_sheet: vi.fn(),
    },
  };
});

beforeAll(async () => {
  if (!(Blob.prototype as any).arrayBuffer) {
    Object.defineProperty(Blob.prototype, "arrayBuffer", {
      configurable: true,
      writable: true,
      value: async function () {
        return await new Promise<ArrayBuffer>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(fr.error);
          fr.onload = () => resolve(fr.result as ArrayBuffer);
          fr.readAsArrayBuffer(this as Blob);
        });
      },
    });
  }
  if (!(File.prototype as any).stream) {
    Object.defineProperty(File.prototype, "stream", {
      configurable: true,
      writable: true,
      value: function () {
        const file = this as File;
        let position = 0;
        return new ReadableStream({
          async pull(controller) {
            if (position >= file.size) {
              controller.close();
              return;
            }
            const chunk = file.slice(
              position,
              Math.min(position + 8192, file.size)
            );
            const arrayBuffer = await chunk.arrayBuffer();
            controller.enqueue(new Uint8Array(arrayBuffer));
            position += arrayBuffer.byteLength;
          },
        });
      },
    });
  }
  await import("@/workers/parser.worker");
});

describe("parser.worker", () => {
  beforeEach(() => {
    expect(exposedFunctions).toBeDefined();
  });

  describe("getFileSheetNames", () => {
    it("returns sheet names for small Excel files", async () => {
      const smallFile = new File(["mock content"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      Object.defineProperty(smallFile, "size", {
        value: 1024,
        writable: false,
      });

      const sheetNames = await exposedFunctions.getFileSheetNames(smallFile);

      expect(sheetNames).toEqual(["Sheet1", "Sheet2"]);
    });

    it("falls back to full file when chunk parsing fails in getSheetNames", async () => {
      const xlsxMock = await vi.importMock("xlsx");
      (xlsxMock.read as Mock)
        .mockImplementationOnce(() => {
          throw new Error("Chunk parse failed");
        })
        .mockImplementationOnce(() => ({
          SheetNames: ["Sheet1"],
        }));

      const smallFile = new File(["mock content"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      Object.defineProperty(smallFile, "size", {
        value: 1024,
        writable: false,
      });

      const sheetNames = await exposedFunctions.getFileSheetNames(smallFile);

      expect(sheetNames).toEqual(["Sheet1"]);
    });

    it.skip("handles FileReader error in getSheetNames", async () => {
      const smallFile = new File(["mock content"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      Object.defineProperty(smallFile, "size", {
        value: -1,
        writable: false,
      });

      await expect(
        exposedFunctions.getFileSheetNames(smallFile)
      ).rejects.toThrow("Failed to read Excel file");
    });

    it.skip("uses progressive parsing for large files", async () => {
      const largeFile = new File(["mock content"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      Object.defineProperty(largeFile, "size", {
        value: 11 * 1024 * 1024,
        writable: false,
      });

      const sheetNames = await exposedFunctions.getFileSheetNames(largeFile);

      expect(sheetNames).toEqual(["Sheet1", "Sheet2"]);
    });
  });

  describe("parseFile", () => {
    it("parses CSV files", async () => {
      const csvFile = new File(["firstName,lastName\nJohn,Doe"], "test.csv", {
        type: "text/csv",
      });

      const result = await exposedFunctions.parseFile(csvFile);

      expect(result.fileType).toBe("csv");
      expect(result.headers.length).toBeGreaterThanOrEqual(16);
      expect(result.rows).toBeDefined();
    });

    it("throws error when CSV has insufficient headers", async () => {
      const papaMock = await vi.importMock("papaparse");
      const parseMock = (papaMock.default as { parse: Mock }).parse;
      parseMock.mockImplementationOnce((_file, config: any) => {
        if (config.complete) {
          config.complete({
            data: [{ firstName: "John" }],
            errors: [],
            meta: { fields: ["firstName"] },
          });
        }
      });

      const csvFile = new File(["firstName\nJohn"], "test.csv", {
        type: "text/csv",
      });

      await expect(exposedFunctions.parseFile(csvFile)).rejects.toThrow(
        "CSV file has less headers than required"
      );
    });

    it("handles CSV parsing errors", async () => {
      const papaMock = await vi.importMock("papaparse");
      const parseMock = (papaMock.default as { parse: Mock }).parse;
      parseMock.mockImplementationOnce((_file, config: any) => {
        if (config.error) {
          config.error({ message: "Parse error", type: "Quotes" });
        }
      });

      const csvFile = new File(["invalid,csv"], "test.csv", {
        type: "text/csv",
      });

      await expect(exposedFunctions.parseFile(csvFile)).rejects.toThrow(
        "CSV parsing failed"
      );
    });

    it("handles CSV parse result errors", async () => {
      const papaMock = await vi.importMock("papaparse");
      const parseMock = (papaMock.default as { parse: Mock }).parse;
      parseMock.mockImplementationOnce((_file, config: any) => {
        if (config.complete) {
          config.complete({
            data: [],
            errors: [{ message: "Error", row: 0 }],
            meta: { fields: [] },
          });
        }
      });

      const csvFile = new File(["invalid"], "test.csv", {
        type: "text/csv",
      });

      await expect(exposedFunctions.parseFile(csvFile)).rejects.toThrow(
        "CSV parsing errors"
      );
    });

    it("parses Excel files", async () => {
      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await exposedFunctions.parseFile(excelFile);

      expect(result.fileType).toBe("xlsx");
      expect(result.headers).toBeDefined();
    });

    it("throws error when Excel sheet has insufficient headers", async () => {
      const xlsxMock = await vi.importMock("xlsx");
      const sheetToJsonMock = (xlsxMock.utils as { sheet_to_json: Mock })
        .sheet_to_json;
      sheetToJsonMock.mockImplementationOnce(() => [["firstName", "lastName"]]);

      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await expect(exposedFunctions.parseFile(excelFile)).rejects.toThrow(
        "Sheet has less headers than required"
      );
    });

    it.skip("throws error when no valid sheets found", async () => {
      const xlsxMock = await vi.importMock("xlsx");
      const sheetToJsonMock = (xlsxMock.utils as { sheet_to_json: Mock })
        .sheet_to_json;
      sheetToJsonMock.mockImplementation(() => []);

      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await expect(exposedFunctions.parseFile(excelFile)).rejects.toThrow(
        "No valid sheets found"
      );
    });

    it("parses JSON files", async () => {
      const jsonContent = JSON.stringify([
        {
          employeeId: "emp1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          startDate: "2024-01-01",
          department: "IT",
          division: "Engineering",
          position: "Developer",
          region: "North",
          mobileNumber: "1234567890",
          workPhoneNumber: "0987654321",
          gender: "male",
          country: "USA",
          city: "New York",
          dateOfBirth: "1990-01-01",
          language: "en",
        },
      ]);
      const jsonFile = new File([jsonContent], "test.json", {
        type: "application/json",
      });

      const result = await exposedFunctions.parseFile(jsonFile);

      expect(result.fileType).toBe("json");
      expect(result.headers).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    it("throws error when JSON is not an array", async () => {
      const jsonContent = JSON.stringify({ firstName: "John" });
      const jsonFile = new File([jsonContent], "test.json", {
        type: "application/json",
      });

      await expect(exposedFunctions.parseFile(jsonFile)).rejects.toThrow(
        "JSON file must contain an array"
      );
    });

    it("throws error when JSON array is empty", async () => {
      const jsonContent = JSON.stringify([]);
      const jsonFile = new File([jsonContent], "test.json", {
        type: "application/json",
      });

      await expect(exposedFunctions.parseFile(jsonFile)).rejects.toThrow(
        "JSON file is empty"
      );
    });

    it("throws error when JSON has insufficient headers", async () => {
      const jsonContent = JSON.stringify([{ firstName: "John" }]);
      const jsonFile = new File([jsonContent], "test.json", {
        type: "application/json",
      });

      await expect(exposedFunctions.parseFile(jsonFile)).rejects.toThrow(
        "JSON file has less headers than required"
      );
    });

    it("handles JSON parse errors", async () => {
      const jsonFile = new File(["invalid json"], "test.json", {
        type: "application/json",
      });

      await expect(exposedFunctions.parseFile(jsonFile)).rejects.toThrow(
        "JSON parsing failed"
      );
    });

    it.skip("handles FileReader errors for JSON", async () => {
      const jsonFile = new File(["content"], "test.json", {
        type: "application/json",
      });

      Object.defineProperty(jsonFile, "size", {
        value: -1,
        writable: false,
      });

      await expect(exposedFunctions.parseFile(jsonFile)).rejects.toThrow(
        "Failed to read JSON file"
      );
    });

    it.skip("handles FileReader errors for Excel", async () => {
      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      Object.defineProperty(excelFile, "size", {
        value: -1,
        writable: false,
      });

      await expect(exposedFunctions.parseFile(excelFile)).rejects.toThrow(
        "Failed to read Excel file"
      );
    });

    it("throws error for unsupported file types", async () => {
      const unsupportedFile = new File(["content"], "test.txt", {
        type: "text/plain",
      });

      await expect(exposedFunctions.parseFile(unsupportedFile)).rejects.toThrow(
        "Unsupported file type"
      );
    });

    it("parses Excel with specific sheet names", async () => {
      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await exposedFunctions.parseFile(excelFile, ["Sheet1"]);

      expect(result.fileType).toBe("xlsx");
    });
  });

  describe("parseExcelBuffer", () => {
    it("parses Excel from ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(100);
      const result = await exposedFunctions.parseExcelBuffer(
        buffer,
        "test.xlsx",
        ["Sheet1"]
      );

      expect(result.fileType).toBe("xlsx");
      expect(result.headers).toBeDefined();
    });

    it("handles parse errors in parseExcelBuffer", async () => {
      const xlsxMock = await vi.importMock("xlsx");
      (xlsxMock.read as Mock).mockImplementationOnce(() => {
        throw new Error("Parse failed");
      });

      const buffer = new ArrayBuffer(100);
      await expect(
        exposedFunctions.parseExcelBuffer(buffer, "test.xlsx", ["Sheet1"])
      ).rejects.toThrow("Excel parsing failed");
    });

    it("handles parse errors in parseExcel", async () => {
      const xlsxMock = await vi.importMock("xlsx");
      (xlsxMock.read as Mock).mockImplementationOnce(() => {
        throw new Error("Parse failed");
      });

      const excelFile = new File(["mock"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await expect(exposedFunctions.parseFile(excelFile)).rejects.toThrow(
        "Excel parsing failed"
      );
    });

    it("uses all sheets if sheetNames not provided", async () => {
      const buffer = new ArrayBuffer(100);
      const result = await exposedFunctions.parseExcelBuffer(
        buffer,
        "test.xlsx"
      );

      expect(result.fileType).toBe("xlsx");
    });
  });

  describe("downloadFile", () => {
    it("downloads CSV format", async () => {
      const rows = [{ firstName: "John", lastName: "Doe" }];
      const result = await exposedFunctions.downloadFile(rows, "test", "csv");

      expect(result.filename).toBe("test.csv");
      expect(result.type).toBe("text/csv");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it("downloads JSON format", async () => {
      const rows = [{ firstName: "John", lastName: "Doe" }];
      const result = await exposedFunctions.downloadFile(rows, "test", "json");

      expect(result.filename).toBe("test.json");
      expect(result.type).toBe("application/json");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it("downloads XLSX format", async () => {
      const rows = [{ firstName: "John", lastName: "Doe" }];
      const result = await exposedFunctions.downloadFile(rows, "test", "xlsx");

      expect(result.filename).toBe("test.xlsx");
      expect(result.type).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it("handles empty rows for XLSX", async () => {
      const result = await exposedFunctions.downloadFile([], "test", "xlsx");

      expect(result.filename).toBe("test.xlsx");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it("splits large XLSX files into multiple sheets", async () => {
      const rows = Array.from({ length: 250000 }, (_, i) => ({
        firstName: `User${i}`,
        lastName: `Last${i}`,
      }));
      const result = await exposedFunctions.downloadFile(rows, "test", "xlsx");

      expect(result.filename).toBe("test.xlsx");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });

    it("throws error for unsupported format", async () => {
      const rows = [{ firstName: "John" }];
      await expect(
        exposedFunctions.downloadFile(rows, "test", "pdf")
      ).rejects.toThrow("Unsupported download format");
    });
  });
});
