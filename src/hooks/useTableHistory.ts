import { useCallback, useRef } from "react";
import {
  CleaningResult,
  GroupedRowError,
  GroupedRowChange,
  HistoryEntry,
  TableState,
} from "../types";

const HISTORY_SIZE = 100;

export const useTableHistory = (
  rows: CleaningResult | null,
  groupedErrors: GroupedRowError[] | null,
  groupedChanges: GroupedRowChange[] | null,
  setRows: (rows: CleaningResult) => void,
  setGroupedErrors: (groupedErrors: GroupedRowError[] | null) => void,
  setGroupedChanges: (groupedChanges: GroupedRowChange[] | null) => void
) => {
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const getTableState = useCallback((): TableState | null => {
    if (!rows) return null;

    return {
      rows: rows.rows,
      errors: rows.errors,
      changes: rows.changes,
      groupedErrors: groupedErrors ?? [],
      groupedChanges: groupedChanges ?? [],
    };
  }, [rows, groupedErrors, groupedChanges]);

  const applyTableState = useCallback((state: TableState) => {
    setRows({
      rows: state.rows,
      errors: state.errors,
      changes: state.changes,
    });
    setGroupedErrors(state.groupedErrors);
    setGroupedChanges(state.groupedChanges);
  }, []);

  const pushHistory = useCallback(
    (label: string, prev: TableState, next: TableState) => {
      const historyArray = historyRef.current.slice(
        0,
        historyIndexRef.current + 1
      );
      historyArray.push({ label, prev, next });

      if (historyArray.length > HISTORY_SIZE) {
        historyArray.shift(); //Remove oldest entry
      }

      historyRef.current = historyArray;
      historyIndexRef.current = historyArray.length - 1;
    },
    []
  );

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex < 0) return;

    const currentEntry = historyRef.current[currentIndex];
    historyIndexRef.current = currentIndex - 1;
    applyTableState(currentEntry.prev);
  }, [applyTableState]);

  const redo = useCallback(() => {
    const nextIndex = historyIndexRef.current + 1;
    if (nextIndex >= historyRef.current.length) return;

    const newEntry = historyRef.current[nextIndex];
    historyIndexRef.current = nextIndex;
    applyTableState(newEntry.next);
  }, [applyTableState]);

  return {
    getTableState,
    applyTableState,
    pushHistory,
    undo,
    redo,
    canUndo: historyIndexRef.current >= 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
  };
};
