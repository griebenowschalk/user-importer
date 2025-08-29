import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { CleaningRule } from "../types";

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
  if (c === "lower") return v.toLowerCase();
  if (c === "upper") return v.toUpperCase();
  return v;
}

export function normalizeBasic(
  v: unknown,
  rule: CleaningRule,
  field: string
): unknown {
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
