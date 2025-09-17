import { useCallback, useEffect, useMemo, useState } from "react";
import { GroupedRowError } from "../types";
import { ColumnDef } from "@tanstack/react-table";
import { Virtualizer } from "@tanstack/react-virtual";

interface UseFindErrorProps {
  groupedErrors: GroupedRowError[];
  columns: ColumnDef<Record<string, unknown>>[];
  mappings: Record<string, string>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  showErrors: boolean;
  cellRefs: Map<string, HTMLTableCellElement>;
  setFocusedCell: (focusedCell: {
    rowIndex: number;
    columnId: string | null;
  }) => void;
}

function useFindError({
  groupedErrors,
  columns,
  mappings,
  rowVirtualizer,
  showErrors,
  cellRefs,
  setFocusedCell,
}: UseFindErrorProps) {
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);

  // Sorted flat error targets derived from rows.errors
  // Build a stable, sorted, de-duplicated list of error targets for navigation.
  // Each entry identifies one cell by its global row index and target field name.
  const errorTargetList = useMemo(() => {
    const unique: { row: number; field: string }[] = [];
    const seen = new Set<string>();

    groupedErrors.forEach(error => {
      error.fields.forEach(field => {
        const key = `${error.row}:${field.field}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({ row: error.row, field: field.field });
        }
      });
    });

    unique.sort((a, b) =>
      a.row === b.row
        ? String(a.field).localeCompare(String(b.field))
        : a.row - b.row
    );
    return unique.map(e => ({ row: e.row, field: String(e.field) }));
  }, [groupedErrors]);

  // Map from target field id → column id in the table (source header)
  // Map target field (e.g. "email") → visible column id (source header) so we can focus the right cell.
  const columnIdByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columns) {
      if (!col?.id || col.id === "_row") continue;
      const target =
        (mappings as Record<string, string> | undefined)?.[col.id] ?? col.id;
      map.set(String(target), col.id);
    }
    return map;
  }, [columns, mappings]);

  // Keep current index in range as errors change
  useEffect(() => {
    if (errorTargetList.length === 0) {
      setCurrentErrorIndex(0);
      return;
    }
    if (currentErrorIndex >= errorTargetList.length) {
      setCurrentErrorIndex(0);
    }
  }, [errorTargetList.length, currentErrorIndex]);

  // Given a global row + field, compute the visible row index in the current view,
  // scroll it into view, and move keyboard focus to the input/select inside the cell.
  const focusError = useCallback(
    (target: { row: number; field: string }) => {
      if (showErrors && !groupedErrors?.length) return;
      // Resolve visible row index depending on current view
      const visibleRowIndex = showErrors
        ? groupedErrors!.findIndex(g => g.row === target.row)
        : target.row;
      if (visibleRowIndex < 0) return;

      try {
        // Scroll the virtualizer to bring the row into view
        (rowVirtualizer as any).scrollToIndex(visibleRowIndex, {
          align: "center",
        });
      } catch {
        // If virtualizer throws, also try native scroll fallback
        const colIdFallback = columnIdByField.get(String(target.field));
        if (colIdFallback) {
          const fallbackKey = `${visibleRowIndex}:${colIdFallback}`;
          const td = cellRefs.get(fallbackKey);
          td?.scrollIntoView({ block: "center", inline: "center" });
        }
      }

      // After scroll, focus the specific cell's input/select
      const colId = columnIdByField.get(String(target.field));
      if (!colId) return;

      // Store a reference key for the TD and set the focused cell for outline styling
      const key = `${visibleRowIndex}:${colId}`;
      setFocusedCell({ rowIndex: visibleRowIndex, columnId: colId });
      // Defer to next frame so DOM is in place after virtualization
      requestAnimationFrame(() => {
        const td = cellRefs.get(key);
        const focusable = td?.querySelector<HTMLElement>("input,select");
        focusable?.focus();
      });
    },
    [
      showErrors,
      groupedErrors,
      columnIdByField,
      setFocusedCell,
      rowVirtualizer,
      cellRefs,
    ]
  );

  return {
    currentErrorIndex,
    setCurrentErrorIndex,
    focusError,
    errorTargetList,
  };
}

export default useFindError;
