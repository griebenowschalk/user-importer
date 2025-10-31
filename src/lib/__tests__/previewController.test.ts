import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPreviewController } from "@/lib/previewController";
import type {
  CleaningResult,
  GroupedRowError,
  TableState,
  RowData,
  User,
} from "@/types";

vi.mock("@/lib/validationClient", () => ({
  validateChunkOptimized: vi.fn(async (rows: RowData[], startRow: number) => {
    return {
      startRow,
      endRow: startRow + rows.length - 1,
      rows,
      errors: [],
      changes: [],
    } as any;
  }),
}));

const mappings: Record<string, keyof User> = { email: "email" } as any;

describe("previewController", () => {
  let state: CleaningResult & {
    groupedErrors: GroupedRowError[];
    groupedChanges: any[];
  };
  let getTableState: () => TableState;
  let setRows: (r: CleaningResult) => void;
  let setGroupedErrors: (e: GroupedRowError[] | null) => void;
  let setGroupedChanges: (c: any[] | null) => void;
  let pushHistory: any;

  beforeEach(() => {
    state = {
      rows: [{ email: "a@example.com" }, { email: "b@example.com" }],
      errors: [],
      changes: [],
      groupedErrors: [],
      groupedChanges: [],
    } as any;
    getTableState = () => ({
      rows: state.rows,
      errors: state.errors as any,
      changes: state.changes as any,
      groupedErrors: state.groupedErrors,
      groupedChanges: state.groupedChanges as any,
    });
    setRows = r => {
      state.rows = r.rows;
      state.errors = r.errors;
      state.changes = r.changes;
    };
    setGroupedErrors = e => {
      state.groupedErrors = (e ?? []) as any;
    };
    setGroupedChanges = c => {
      state.groupedChanges = (c ?? []) as any;
    };
    pushHistory = vi.fn();
  });

  afterEach(() => vi.clearAllMocks());

  it("validateAndUpdateRow replaces row and pushes history", async () => {
    const controller = createPreviewController({
      mappings,
      getTableState,
      setRows,
      setGroupedErrors,
      setGroupedChanges,
      pushHistory,
      fileRows: [...state.rows],
    });

    await controller.validateAndUpdateRow(
      { email: "z@example.com" },
      0,
      "replace",
      "edit"
    );

    expect(state.rows[0]).toEqual({ email: "z@example.com" });
    expect(pushHistory).toHaveBeenCalled();
  });

  it("deleteRows removes selected and remaps indices", () => {
    (state as any).errors = [
      { row: 1, field: "email", message: "bad", value: "" },
    ];

    const controller = createPreviewController({
      mappings,
      getTableState,
      setRows,
      setGroupedErrors,
      setGroupedChanges,
      pushHistory,
      fileRows: [...state.rows],
    });

    controller.deleteRows([0], false, []);

    expect(state.rows.length).toBe(1);
    expect(state.errors[0].row).toBe(0);
    expect(pushHistory).toHaveBeenCalled();
  });

  it("duplicateRow inserts validated row and pushes history", async () => {
    const controller = createPreviewController({
      mappings,
      getTableState,
      setRows,
      setGroupedErrors,
      setGroupedChanges,
      pushHistory,
      fileRows: [...state.rows],
    });

    await controller.duplicateRow(0, false, []);

    expect(state.rows.length).toBe(3);
    expect(state.rows[1]).toEqual({ email: "a@example.com" });
    expect(pushHistory).toHaveBeenCalled();
  });
});
