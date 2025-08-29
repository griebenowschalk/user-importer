import type { ColumnHook, RowHook } from "../types";

const columnHookRegistry: Record<string, ColumnHook> = {
  stripSpaces: v => (typeof v === "string" ? v.replace(/\s+/g, "") : v),
  normalizePhone: v => (typeof v === "string" ? v.replace(/[^\d+]/g, "") : v),
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
