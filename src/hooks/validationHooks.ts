import type { ColumnHook, RowHook } from "../types";
import { PATTERNS } from "../validation/schema";

const columnHookRegistry: Record<string, ColumnHook> = {
  employeeId: (value: unknown) => {
    if (typeof value !== "string" || !value) return value;

    return value
      .replace(/\s+/g, "")
      .toLowerCase()
      .split("")
      .filter(char => PATTERNS.EMPLOYEE_ID.test(char))
      .join("");
  },
};

const rowHookRegistry: Record<string, RowHook> = {
  onEntryInit: row => {
    const cc = String(row.country ?? "").toUpperCase();
    if (
      cc === "ZAF" &&
      typeof row.mobileNumber === "string" &&
      row.mobileNumber.startsWith("0")
    ) {
      row = { ...row, mobileNumber: "+27" + row.mobileNumber.slice(1) };
    }
    return row;
  },
};

export { columnHookRegistry, rowHookRegistry };
