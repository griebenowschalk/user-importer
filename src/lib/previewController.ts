import { validateChunkOptimized } from "@/lib/validationClient";
import { groupErrorsByRow, groupChangesByRow } from "@/lib/utils";
import type {
  GroupedRowError,
  GroupedRowChange,
  TableState,
  CleaningResult,
  User,
  RowData,
} from "@/types";

interface Deps {
  mappings: Record<string, keyof User>;
  getTableState: () => TableState;
  setRows: (rows: CleaningResult) => void;
  setGroupedErrors: (errs: GroupedRowError[] | null) => void;
  setGroupedChanges: (chg: GroupedRowChange[] | null) => void;
  pushHistory: (label: string, prev: TableState, next: TableState) => void;
  fileRows: RowData[];
}

export function createPreviewController(deps: Deps) {
  const {
    mappings,
    getTableState,
    setRows,
    setGroupedErrors,
    setGroupedChanges,
    pushHistory,
    fileRows,
  } = deps;

  async function validateAndUpdateRow(
    rowData: RowData,
    targetRowIndex: number,
    mode: "replace" | "add",
    label?: string,
    options?: { pushHistory?: boolean }
  ) {
    const chunk = await validateChunkOptimized(
      [rowData],
      targetRowIndex,
      mappings
    );
    const prevState = getTableState();

    const current = getTableState();
    const mergedRows = current.rows.slice();
    if (chunk.rows[0]) mergedRows[targetRowIndex] = chunk.rows[0];

    let newErrors = current.errors;
    let newChanges = current.changes;
    if (mode === "replace") {
      const otherErrors = (current.errors ?? []).filter(
        e => e.row !== targetRowIndex
      );
      const otherChanges = (current.changes ?? []).filter(
        c => c.row !== targetRowIndex
      );
      newErrors = otherErrors.concat(chunk.errors);
      newChanges = otherChanges.concat(chunk.changes);
    } else {
      newErrors = current.errors.concat(chunk.errors);
      newChanges = current.changes.concat(chunk.changes);
    }

    const nextGroupedErrors = groupErrorsByRow(newErrors);
    const nextGroupedChanges = groupChangesByRow(newChanges);

    const nextState: TableState = {
      rows: mergedRows,
      errors: newErrors,
      changes: newChanges,
      groupedErrors: nextGroupedErrors,
      groupedChanges: nextGroupedChanges,
    };

    setRows({ rows: mergedRows, errors: newErrors, changes: newChanges });
    setGroupedErrors(nextGroupedErrors);
    setGroupedChanges(nextGroupedChanges);

    if (options?.pushHistory !== false) {
      pushHistory(
        label ?? `Edit row ${targetRowIndex + 1}`,
        prevState,
        nextState
      );
    }
  }

  function deleteRows(
    indices: number[],
    showErrors: boolean,
    groupedErrorsArg: GroupedRowError[] | null
  ) {
    const prevState = getTableState();
    const actualIndices = indices
      .map(idx => (showErrors ? (groupedErrorsArg?.[idx]?.row ?? idx) : idx))
      .sort((a, b) => a - b);

    const current = getTableState();
    const newRows = current.rows.filter(
      (_, idx) => !actualIndices.includes(idx)
    );

    const indexMap = new Map<number, number>();
    let newIndex = 0;
    for (let i = 0; i < current.rows.length; i++) {
      if (!actualIndices.includes(i)) indexMap.set(i, newIndex++);
    }

    const newErrors = (current.errors ?? [])
      .filter(e => !actualIndices.includes(e.row))
      .map(e => ({ ...e, row: indexMap.get(e.row) ?? e.row }));
    const newChanges = (current.changes ?? [])
      .filter(c => !actualIndices.includes(c.row))
      .map(c => ({ ...c, row: indexMap.get(c.row) ?? c.row }));

    const nextGroupedErrors = groupErrorsByRow(newErrors);
    const nextGroupedChanges = groupChangesByRow(newChanges);

    const nextState: TableState = {
      rows: newRows,
      errors: newErrors,
      changes: newChanges,
      groupedErrors: nextGroupedErrors,
      groupedChanges: nextGroupedChanges,
    };

    setRows({ rows: newRows, errors: newErrors, changes: newChanges });
    setGroupedErrors(nextGroupedErrors);
    setGroupedChanges(nextGroupedChanges);

    pushHistory(
      `Delete rows ${actualIndices.join(", ")}`,
      prevState,
      nextState
    );
  }

  async function duplicateRow(
    rowIndex: number,
    showErrors: boolean,
    groupedErrorsArg: GroupedRowError[] | null
  ) {
    const prevState = getTableState();
    const current = getTableState();

    const actualRowIndex = showErrors
      ? (groupedErrorsArg?.[rowIndex]?.row ?? rowIndex)
      : rowIndex;
    const rowToDuplicate = current.rows[actualRowIndex];
    if (!rowToDuplicate) return;

    const duplicatedRowIndex = actualRowIndex + 1;
    const chunk = await validateChunkOptimized(
      [rowToDuplicate],
      duplicatedRowIndex,
      mappings
    );
    const validatedRow = chunk.rows[0] ?? rowToDuplicate;

    const shiftedErrors = (current.errors ?? []).map(e => ({
      ...e,
      row: e.row >= duplicatedRowIndex ? e.row + 1 : e.row,
    }));
    const shiftedChanges = (current.changes ?? []).map(c => ({
      ...c,
      row: c.row >= duplicatedRowIndex ? c.row + 1 : c.row,
    }));

    const newRows = [
      ...current.rows.slice(0, duplicatedRowIndex),
      validatedRow,
      ...current.rows.slice(duplicatedRowIndex),
    ];

    const newErrors = shiftedErrors.concat(chunk.errors);
    const newChanges = shiftedChanges.concat(chunk.changes);

    const nextGroupedErrors = groupErrorsByRow(newErrors);
    const nextGroupedChanges = groupChangesByRow(newChanges);

    const nextState: TableState = {
      rows: newRows,
      errors: newErrors,
      changes: newChanges,
      groupedErrors: nextGroupedErrors,
      groupedChanges: nextGroupedChanges,
    };

    setRows({ rows: newRows, errors: newErrors, changes: newChanges });
    setGroupedErrors(nextGroupedErrors);
    setGroupedChanges(nextGroupedChanges);

    pushHistory(`Duplicate row ${actualRowIndex + 1}`, prevState, nextState);
  }

  function getBaseRow(actualRowIndex: number): RowData {
    const current = getTableState();
    return (
      (current.rows?.[actualRowIndex] as RowData) ??
      (fileRows[actualRowIndex] as RowData)
    );
  }

  return {
    validateAndUpdateRow,
    deleteRows,
    duplicateRow,
    getBaseRow,
  } as const;
}
