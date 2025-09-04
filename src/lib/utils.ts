import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  CleaningRule,
  ValidationError,
  GroupedRowError,
  GroupedFieldError,
  CleaningChange,
  GroupedRowChange,
  GroupedFieldChange,
} from "../types";
import { Row } from "@tanstack/react-table";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function checkIfExcel(fileName: string) {
  return fileName.toLowerCase().match(/\.(xls|xlsx)$/);
}

export function getOptionSet(rule: CleaningRule) {
  return new Set(
    Object.values(rule.options ?? {}).map(o =>
      rule.case === "upper"
        ? String(o).toUpperCase()
        : rule.case === "lower"
          ? String(o).toLowerCase()
          : String(o)
    )
  );
}

export function trimValue(v: string, mode: string): string {
  if (typeof v !== "string" || !v) return v;
  switch (mode) {
    case "both":
      return v.trim();
    case "left":
      return v.replace(/^\s+/, "");
    case "right":
      return v.replace(/\s+$/, "");
    case "normalizeSpaces":
      return v.trim().replace(/\s+/g, " ");
    default:
      return v;
  }
}

export function normalizeCase(
  v: string,
  c: "lower" | "upper" | "none"
): string {
  if (typeof v !== "string" || !v) return v;
  if (c === "lower") return v.toLowerCase();
  if (c === "upper") return v.toUpperCase();
  return v;
}

export function normalizeBasic(
  v: unknown,
  rule: CleaningRule,
  field: string
): unknown {
  if (typeof v !== "string" || !v) return v;
  if (
    rule?.normalize?.phoneDigitsOnly &&
    (field.includes("phone") || rule.type === "phone")
  ) {
    if (typeof v === "string") return v.replace(/[^\d+]/g, "");
  }
  if (rule?.normalize?.toISO3 && rule.type === "country") {
    if (typeof v === "string") return v.replace(/\s+/g, "").toUpperCase();
  }
  return v;
}

export function groupErrorsByRow(errors: ValidationError[]): GroupedRowError[] {
  const grouped = new Map<number, Map<string, GroupedFieldError>>();

  for (const error of errors) {
    if (!grouped.has(error.row)) {
      grouped.set(error.row, new Map());
    }

    const rowGroup = grouped.get(error.row)!;
    const fieldKey = error.field;

    if (!rowGroup.has(fieldKey)) {
      rowGroup.set(fieldKey, {
        field: fieldKey,
        messages: [],
        value: error.value,
      });
    }

    rowGroup.get(fieldKey)!.messages.push(error.message);
  }

  return Array.from(grouped.entries())
    .map(([row, fields]) => ({
      row,
      fields: Array.from(fields.values()),
    }))
    .sort((a, b) => a.row - b.row);
}

export function groupChangesByRow(
  changes: CleaningChange[]
): GroupedRowChange[] {
  const grouped = new Map<number, Map<string, GroupedFieldChange>>();

  for (const change of changes) {
    if (!grouped.has(change.row)) {
      grouped.set(change.row, new Map());
    }

    const rowGroup = grouped.get(change.row)!;
    const fieldKey = change.field;

    if (!rowGroup.has(fieldKey)) {
      rowGroup.set(fieldKey, {
        field: fieldKey,
        messages: [],
        value: change.originalValue,
      });
    }

    rowGroup.get(fieldKey)!.messages.push(change.description);
  }

  return (
    Array.from(grouped.entries()).map(([row, fields]) => ({
      row,
      fields: Array.from(fields.values()),
    })) as unknown as GroupedRowChange[]
  ).sort((a, b) => a.row - b.row);
}

export function getGroupedFieldError(
  grouped: GroupedRowError[] | null,
  field: string,
  showErrors: boolean,
  row: Row<Record<string, unknown>>
) {
  return grouped?.find(
    (g, index) =>
      ((!showErrors && g.row === row.index) ||
        (showErrors && index === row.index)) &&
      g.fields.some(f => f.field === field)
  );
}

export function getGroupedFieldChange(
  grouped: GroupedRowChange[] | null,
  field: string,
  row: Row<Record<string, unknown>>
) {
  return grouped?.find(
    g => g.row === row.index && g.fields.some(f => f.field === field)
  );
}

export function getGroupedFieldMessages(
  grouped: GroupedRowError | GroupedRowChange,
  field: string
) {
  return (
    grouped.fields.find(f => f.field === field)?.messages.join("\n ") ?? ""
  );
}
