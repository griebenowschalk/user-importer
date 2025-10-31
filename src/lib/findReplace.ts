import { toRegex, groupErrorsByRow, groupChangesByRow } from "@/lib/utils";
import type {
  GroupedRowChange,
  GroupedRowError,
  ValidationChunk,
  RowData,
  CleaningResult,
  User,
  ValidationError,
  CleaningChange,
} from "@/types";

export function computeMatches(data: RowData[], field: string, regex: RegExp) {
  const matches = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    if (field === "all") {
      const keys = Object.keys(data[i] ?? {});
      for (const key of keys) {
        const value = (data[i] as Record<string, unknown>)[key];
        if (value != null && String(value).match(regex)) {
          matches.add(`${i}:${key}`);
        }
      }
    } else {
      const value = (data[i] as Record<string, unknown>)[field];
      if (value != null && String(value).match(regex)) {
        matches.add(`${i}:${field}`);
      }
    }
  }
  return matches;
}

export async function bulkFindReplace(args: {
  data: RowData[];
  rows: CleaningResult | null;
  fileDataRows: RowData[];
  mappings: Record<string, keyof User>;
  find: string;
  field: string;
  exactMatch?: boolean;
  replace: string;
  validateChunk: (
    rows: RowData[],
    startRow: number,
    mappings: Record<string, keyof User>
  ) => Promise<ValidationChunk>;
  getTableState: () => CleaningResult;
}) {
  const {
    data,
    rows,
    fileDataRows,
    mappings,
    find,
    field,
    exactMatch,
    replace,
    validateChunk,
    getTableState,
  } = args;
  const base = toRegex(find, exactMatch);
  const regex = base.flags.includes("g")
    ? base
    : new RegExp(base, `${base.flags}g`);

  const byRow = new Map<number, RowData>();
  const affectedRows = new Set<number>();

  for (let i = 0; i < data.length; i++) {
    const rowObj = data[i] ?? {};
    const keys = field === "all" ? Object.keys(rowObj) : [field];
    let mutated = false;

    const raw = (byRow.get(i) ?? {
      ...((rows?.rows?.[i] as RowData) ?? (fileDataRows[i] as RowData)),
    }) as RowData;

    for (const key of keys) {
      const value = (rowObj as Record<string, unknown>)[key];
      const stringValue = String(value);
      if (value != null && regex.test(stringValue)) {
        regex.lastIndex = 0;
        const next = stringValue.replace(regex, replace ?? "");
        if (next !== stringValue) {
          mutated = true;
          (raw as Record<string, unknown>)[key] = next;
        }
      }
    }
    if (mutated) {
      byRow.set(i, raw);
      affectedRows.add(i);
    }
  }

  if (byRow.size === 0) return null;

  const sorted = [...byRow.keys()].sort((a, b) => a - b);
  const runs: Array<{ start: number; indices: number[] }> = [];
  let run: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
    else {
      runs.push({ start: run[0], indices: run });
      run = [sorted[i]];
    }
  }
  if (run.length) runs.push({ start: run[0], indices: [...run] });

  const chunks: { chunk: ValidationChunk; indices: number[] }[] = [];
  for (const r of runs) {
    const rawRows = r.indices.map(i => byRow.get(i)!) as RowData[];
    const chunk = await validateChunk(rawRows, r.start, mappings);
    chunks.push({ chunk, indices: r.indices });
  }

  const prev = getTableState();
  const mergedRows = prev.rows.slice();
  for (const { indices, chunk } of chunks) {
    for (let i = 0; i < indices.length; i++) {
      const index = chunk.startRow + i;
      mergedRows[index] = chunk.rows[i];
    }
  }
  const otherErrors = (prev.errors ?? []).filter(
    e => ![...affectedRows].includes(e.row)
  );
  const otherChanges = (prev.changes ?? []).filter(
    c => ![...affectedRows].includes(c.row)
  );
  const newErrors: ValidationError[] = otherErrors.concat(
    ...chunks.map(c => c.chunk.errors)
  );
  const newChanges: CleaningChange[] = otherChanges.concat(
    ...chunks.map(c => c.chunk.changes)
  );

  const nextGroupedErrors = groupErrorsByRow(newErrors);
  const nextGroupedChanges = groupChangesByRow(newChanges);

  return {
    nextRows: mergedRows,
    nextErrors: newErrors,
    nextChanges: newChanges,
    nextGroupedErrors,
    nextGroupedChanges,
    affectedSize: byRow.size,
  } as {
    nextRows: RowData[];
    nextErrors: ValidationError[];
    nextChanges: CleaningChange[];
    nextGroupedErrors: GroupedRowError[];
    nextGroupedChanges: GroupedRowChange[];
    affectedSize: number;
  };
}
