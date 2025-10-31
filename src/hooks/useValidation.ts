import { useEffect, useState } from "react";
import type {
  FileParseResult,
  ValidationProgress,
  CleaningResult,
  GroupedRowError,
  GroupedRowChange,
  User,
} from "@/types";
import { validateRowsOptimized } from "@/lib/validationClient";

export function useValidation(
  fileData: FileParseResult | null,
  mappings: Record<string, keyof User> | null
) {
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  const [rows, setRows] = useState<CleaningResult | null>(null);
  const [groupedErrors, setGroupedErrors] = useState<GroupedRowError[] | null>(
    null
  );
  const [groupedChanges, setGroupedChanges] = useState<
    GroupedRowChange[] | null
  >(null);

  useEffect(() => {
    if (!fileData || !mappings || Object.keys(mappings).length === 0) return;
    let cancelled = false;

    (async () => {
      const result = await validateRowsOptimized(
        fileData.rows,
        mappings,
        progress => {
          if (!cancelled) setValidationProgress(progress);
        }
      );
      if (!cancelled) {
        setRows({
          rows: result.chunks.flatMap(c => c.rows),
          errors: result.chunks.flatMap(c => c.errors),
          changes: result.chunks.flatMap(c => c.changes),
        });
        setGroupedErrors(result.groupedErrors ?? null);
        setGroupedChanges(result.groupedChanges ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileData, mappings]);

  return {
    validationProgress,
    rows,
    setRows,
    groupedErrors,
    setGroupedErrors,
    groupedChanges,
    setGroupedChanges,
  } as const;
}
