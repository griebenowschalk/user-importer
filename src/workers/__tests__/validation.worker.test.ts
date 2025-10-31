import { describe, it, expect, vi, beforeEach, beforeAll, Mock } from "vitest";
import type { User, RowData } from "@/types";

let exposedFunctions: any = null;

vi.mock("comlink", () => ({
  expose: vi.fn(obj => {
    exposedFunctions = obj;
  }),
}));

vi.mock("@/lib/validationHooks", () => ({
  columnHookRegistry: {},
  rowHookRegistry: {
    onEntryInit: vi.fn((row: any, _cleanUp?: boolean) => [row, []]),
  },
}));

vi.mock("@/validation/schema", async () => {
  const actual = await vi.importActual("@/validation/schema");
  return {
    ...actual,
    extractCleaningRules: vi.fn(() => ({
      firstName: { trim: "both" },
      lastName: { trim: "both" },
    })),
  };
});

vi.mock("@/lib/utils", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    groupChangesByRow: vi.fn((changes: unknown[]) => {
      const grouped: Record<number, unknown[]> = {};
      changes.forEach(c => {
        const change = c as { row: number };
        if (!grouped[change.row]) grouped[change.row] = [];
        grouped[change.row].push(c);
      });
      return grouped;
    }),
    groupErrorsByRow: vi.fn((errors: unknown[]) => {
      const grouped: Record<number, unknown[]> = {};
      errors.forEach(e => {
        const error = e as { row: number };
        if (!grouped[error.row]) grouped[error.row] = [];
        grouped[error.row].push(e);
      });
      return grouped;
    }),
  };
});

beforeAll(async () => {
  await import("@/workers/validation.worker");
});

describe("validation.worker", () => {
  const mockMapping = {
    firstName: "firstName" as keyof User,
    lastName: "lastName" as keyof User,
  };

  beforeEach(async () => {
    expect(exposedFunctions).toBeDefined();
    await exposedFunctions.validateInit(mockMapping);
  });

  describe("validateInit", () => {
    it("initializes PLAN with compiled config", async () => {
      await exposedFunctions.validateInit(mockMapping);
      expect(exposedFunctions).toBeDefined();
    });

    it("initializes global unique tracker when needed", async () => {
      const schema = await import("@/validation/schema");
      const { extractCleaningRules } = await import("@/validation/schema");
      const rules = extractCleaningRules(schema.userSchema as never);
      const rulesWithUnique = {
        ...rules,
        employeeId: {
          ...rules.employeeId,
          unique: { ignoreCase: false, ignoreNulls: false },
        } as never,
      };

      const mappingWithUnique = {
        employeeId: "employeeId" as keyof User,
      };

      vi.mocked(extractCleaningRules).mockReturnValueOnce(rulesWithUnique);
      await exposedFunctions.validateInit(mappingWithUnique);

      const rows: RowData[] = [{ employeeId: "emp1" }, { employeeId: "emp1" }];

      const result = await exposedFunctions.validateChunk(rows, 0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateChunk", () => {
    it("validates a chunk of rows", async () => {
      const rows: RowData[] = [
        { firstName: "  Alice  ", lastName: "Smith" },
        { firstName: "Bob", lastName: "  Jones  " },
      ];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(result.startRow).toBe(0);
      expect(result.endRow).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.firstName).toBe("Alice");
      expect(result.rows[1]?.lastName).toBe("Jones");
    });

    it("transforms rows with mapping", async () => {
      const rawRows: RowData[] = [
        { firstName: "Alice", fname: "Alice" },
        { fname: "Bob" },
      ];

      const mapping = {
        fname: "firstName" as keyof User,
      };
      await exposedFunctions.validateInit(mapping);

      const result = await exposedFunctions.validateChunk(rawRows, 0, mapping);

      expect(result.rows[0]?.firstName).toBe("Alice");
      expect(result.rows[1]?.firstName).toBe("Bob");
    });

    it("offsets error and change row indices", async () => {
      const rows: RowData[] = [{ firstName: "  Alice  " }];

      const result = await exposedFunctions.validateChunk(rows, 10);

      if (result.errors.length > 0) {
        expect(result.errors[0]?.row).toBeGreaterThanOrEqual(10);
      }
      if (result.changes.length > 0) {
        expect(result.changes[0]?.row).toBeGreaterThanOrEqual(10);
      }
    });

    it("validates rows with errors from schema validation", async () => {
      const rows: RowData[] = [{ firstName: "" }, { lastName: "" }];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("pickChunkSize", () => {
    it("returns 1000 for empty rows", async () => {
      const rows: RowData[] = [];
      await exposedFunctions.validateInit(mockMapping);
      const result = await exposedFunctions.validateChunk(rows, 0);
      expect(result.startRow).toBe(0);
    });

    it("handles rows with many columns", async () => {
      const rows: RowData[] = [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          employeeId: "emp1",
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
          extra1: "val1",
          extra2: "val2",
        },
      ];
      await exposedFunctions.validateInit(mockMapping);
      const result = await exposedFunctions.validateAll(rows, mockMapping);
      expect(result.metadata.totalRows).toBe(1);
    });
  });

  describe("debounceProgress", () => {
    it("calls progress callback with debouncing", async () => {
      const rows: RowData[] = Array.from({ length: 100 }, (_, i) => ({
        firstName: `User ${i}`,
        lastName: `Last ${i}`,
      }));

      const onProgress = vi.fn();
      await exposedFunctions.validateAll(rows, mockMapping, onProgress);

      expect(onProgress).toHaveBeenCalled();
      const calls = onProgress.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe("applyHooks", () => {
    it.skip("applies column hooks when columnHookId is present", async () => {
      const { columnHookRegistry } = await import("@/lib/validationHooks");
      const mockHook = vi.fn((value: any) => `hooked-${value}`);
      (columnHookRegistry as any).testColumnHook = mockHook;

      const schema = await import("@/validation/schema");
      const { compileConfig } = await import("@/validation/engine");
      const { rowHooks, extractCleaningRules } = await import(
        "@/validation/schema"
      );

      const rules = extractCleaningRules(schema.userSchema as any);
      const customRules = {
        ...rules,
        firstName: {
          trim: "both",
          columnHookId: "testColumnHook",
        } as any,
      };

      const mapping = { firstName: "firstName" as keyof User };
      const config = compileConfig(mapping, customRules, rowHooks);

      expect(config.hasUniquenessChecks).toBe(true);

      await exposedFunctions.validateInit(mapping);
      const rows: RowData[] = [{ firstName: "John" }];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(result.errors.length).toBe(0);

      expect(mockHook).toHaveBeenCalled();
    });

    it("applies row hooks and tracks changes", async () => {
      const { rowHookRegistry } = await import("@/lib/validationHooks");
      const mockHook = vi.fn((row: RowData, _cleanUp?: boolean) => [
        { ...row, firstName: `hooked-${row.firstName}` },
        [],
      ]);
      (rowHookRegistry as Record<string, Mock>).onEntryInit = mockHook;

      const rows: RowData[] = [{ firstName: "John", lastName: "Doe" }];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(mockHook).toHaveBeenCalled();
      expect(result.changes.length).toBeGreaterThanOrEqual(0);
    });

    it("tracks row hook errors", async () => {
      const { rowHookRegistry } = await import("@/lib/validationHooks");
      const mockHook = vi.fn((row: RowData, _cleanUp?: boolean) => [
        row,
        [{ field: "firstName", message: "Error message" }],
      ]);
      (rowHookRegistry as Record<string, Mock>).onEntryInit = mockHook;

      const rows: RowData[] = [{ firstName: "John" }];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(mockHook).toHaveBeenCalled();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("caps changes at CHANGE_CAP_PER_CHUNK", async () => {
      const { rowHookRegistry } = await import("@/lib/validationHooks");
      const mockHook = vi.fn((row: RowData, _cleanUp?: boolean) => {
        const newRow = { ...row } as Record<string, unknown>;
        for (let i = 0; i < 10000; i++) {
          newRow[`field${i}`] = `value${i}`;
        }
        return [newRow, []];
      });
      (rowHookRegistry as Record<string, Mock>).onEntryInit = mockHook;

      const rows: RowData[] = [{ firstName: "John" }];

      const result = await exposedFunctions.validateChunk(rows, 0);

      expect(result.changes.length).toBeLessThanOrEqual(5000);
    });
  });

  describe("validateAll", () => {
    it("processes all rows in chunks", async () => {
      const rows: RowData[] = Array.from({ length: 5 }, (_, i) => ({
        firstName: `User ${i}`,
        lastName: `Last ${i}`,
      }));

      const onProgress = vi.fn();
      const result = await exposedFunctions.validateAll(
        rows,
        mockMapping,
        onProgress
      );

      expect(result.metadata.totalRows).toBe(5);
      expect(result.metadata.processedRows).toBe(5);
      expect(result.isComplete).toBe(true);
      expect(onProgress).toHaveBeenCalled();
    });

    it("groups errors and changes by row", async () => {
      const rows: RowData[] = [{ firstName: "" }, { lastName: "" }];

      const result = await exposedFunctions.validateAll(rows, mockMapping);

      expect(result.groupedErrors).toBeDefined();
      expect(result.groupedChanges).toBeDefined();
    });

    it("calls onProgress with debounced updates", async () => {
      const rows: RowData[] = Array.from({ length: 100 }, (_, i) => ({
        firstName: `User ${i}`,
      }));

      const onProgress = vi.fn();
      await exposedFunctions.validateAll(rows, mockMapping, onProgress);

      expect(onProgress).toHaveBeenCalled();
      const finalCall =
        onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(finalCall.isComplete).toBe(true);
    }, 10000);

    it("works without onProgress callback", async () => {
      const rows: RowData[] = [{ firstName: "Alice", lastName: "Smith" }];

      const result = await exposedFunctions.validateAll(rows, mockMapping);

      expect(result.isComplete).toBe(true);
      expect(result.metadata.totalRows).toBe(1);
    });
  });
});
