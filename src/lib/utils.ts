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
import {
  format as formatDateFns,
  parse as parseDateFns,
  isValid,
} from "date-fns";
import { CountryProperty, customList } from "country-codes-list";
import {
  CountryCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { toAlpha2 } from "i18n-iso-countries";

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
  // Allow numbers for dates (Excel serials). Only return early if truly empty/null.
  if (v === null || v === undefined) return v;
  if (typeof v === "string" && v.length === 0) return v;
  if (
    rule.normalize?.toEmployeeId &&
    (field.includes("id") || rule.type === "id")
  ) {
    if (typeof v === "string") {
      return v.replace(/[^a-z0-9-#]/gi, "").toLowerCase();
    }
    return v;
  }
  if (
    rule?.normalize?.phoneDigitsOnly &&
    (field.includes("phone") || rule.type === "phone")
  ) {
    if (typeof v === "number") {
      v = String(v);
    }
    if (typeof v === "string") {
      let phoneNumber = v || "";

      if (phoneNumber && /^[0]{2}/.test(phoneNumber)) {
        phoneNumber = `+${v.slice(2, v.length)}`;
      }

      if (phoneNumber && /^[0]{1}/.test(phoneNumber)) {
        phoneNumber = `+${v.slice(1, v.length)}`;
      }

      if (phoneNumber && !/^\+/.test(phoneNumber)) {
        phoneNumber = `+${phoneNumber}`;
      }

      return phoneNumber.replace(/[^\d+\s]/g, "");
    }

    return v;
  }
  if (rule?.normalize?.toISO3 && rule.type === "country") {
    if (typeof v === "string") return v.replace(/\s+/g, "").toUpperCase();
  }
  if (rule?.normalize?.toISODate && rule.type === "date") {
    const asString = String(v).trim();

    let date: Date;
    if (typeof v === "number") {
      date = excelSerialToDate(v);
    } else if (/^\d{1,6}$/.test(asString)) {
      date = excelSerialToDate(Number(asString));
    } else {
      // Try a set of common CSV/JSON date formats before falling back
      const candidateFormats = [
        "yyyy-MM-dd", // ISO
        "M/d/yy",
        "M/d/yyyy",
        "MM/dd/yyyy",
        "dd/MM/yyyy",
        "d/M/yy",
        "yyyy/MM/dd",
        "MM-dd-yyyy",
        "dd-MM-yyyy",
      ];

      let parsed: Date | null = null;
      for (const pattern of candidateFormats) {
        const attempt = parseDateFns(asString, pattern, new Date());
        if (isValid(attempt)) {
          parsed = attempt;
          break;
        }
      }

      if (!parsed) {
        const native = new Date(asString);
        parsed = isValid(native) ? native : null;
      }
      date = parsed ?? new Date(NaN);
    }

    return formatDateFns(date, "yyyy-MM-dd");
  }
  return v;
}

const excelSerialToDate = (dateNumber: number) => {
  // Excel epoch is 1899-12-30 (accounts for the 1900 leap year bug)
  const excelEpoch = new Date(1899, 11, 30).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(excelEpoch + dateNumber * msPerDay);
};

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

export const checkValidNumber = (country: string, number: string) => {
  const countryCodesList = customList(
    "countryCode" as CountryProperty,
    "{countryCallingCode}"
  );
  const alpha2Code = toAlpha2(country);
  const callingCode = alpha2Code
    ? (countryCodesList[alpha2Code as keyof typeof countryCodesList] as string)
    : "";

  try {
    const phoneNumber = isValidPhoneNumber(number, {
      defaultCountry: alpha2Code as CountryCode,
    });

    return {
      valid: phoneNumber,
      callingCode,
    };
  } catch {
    return { valid: false, callingCode };
  }
};

export const checkValidNumberCore = (country: string, number: string) => {
  const countryCodesList = customList(
    "countryCode" as CountryProperty,
    "{countryCallingCode}"
  );
  const alpha2Code = toAlpha2(country);
  const callingCode = alpha2Code
    ? (countryCodesList[alpha2Code as keyof typeof countryCodesList] as string)
    : "";

  try {
    const phoneNumber = isValidPhoneNumber(number, {
      defaultCountry: alpha2Code as CountryCode,
    });

    const parsed = parsePhoneNumberFromString(number);
    const numberCallingCode = parsed?.countryCallingCode ?? "";

    return {
      valid: phoneNumber,
      callingCode,
      numberCallingCode,
    };
  } catch {
    return { valid: false, callingCode, numberCallingCode: "" };
  }
};

export const numberUpdate = (
  key: string,
  number: string,
  country: string,
  callingCode: string,
  cleanUp?: boolean
) => {
  let validNumber = false;
  let newNumber = number;
  let error = null;
  if (cleanUp && number) {
    newNumber = number.startsWith(`+${callingCode}`)
      ? number
      : `+${callingCode}${(number as string).slice(1)}`;
    validNumber = checkValidNumber(country as string, newNumber).valid;
  }

  if (!validNumber) {
    error = {
      field: key,
      message:
        "Invalid number. The phone number needs to start with + followed by the country code and be the correct length. " +
        "In this case the country code is " +
        callingCode,
    };
  }

  return { newNumber, error };
};

// fixed column widths based on content type
export const getColumnWidth = (header: string) => {
  if (header.includes("email")) return 200;
  if (
    header.includes("language") ||
    header.includes("country") ||
    header === "_row" ||
    header === "#"
  )
    return 80;
  if (
    header.toLowerCase().includes("name") ||
    header.toLowerCase().includes("id") ||
    header.toLowerCase().includes("date") ||
    header.toLowerCase().includes("phone")
  )
    return 120;
  return 150; // default width
};

// escape all regex special characters
export const escapeRegex = (input: string) => {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// convert a string to a regex
export const toRegex = (input: string, exactMatch?: boolean) => {
  if (exactMatch) {
    return new RegExp(`^${escapeRegex(input)}$`, "i");
  }
  const m = input.match(/^\/(.*)\/([gimsuy]*)$/);
  if (!m) return new RegExp(escapeRegex(input), "i");
  return new RegExp(m[1], m[2] || "g");
};
