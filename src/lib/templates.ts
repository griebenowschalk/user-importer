import * as XLSX from "xlsx";
import Papa from "papaparse";
import { fields } from "@/localisation/fields";
import { USER_KEYS, User } from "@/types";

const headerDescription = (key: keyof User): string =>
  (fields as Record<string, string>)[`${key}_description`] ?? "";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadExcelTemplate = (filename = "user-template.xlsx") => {
  const headers = USER_KEYS as readonly string[];

  const ws = XLSX.utils.json_to_sheet([], {
    header: headers as string[],
  });

  headers.forEach((header, index) => {
    const col = XLSX.utils.encode_col(index); // "A", "B", ...
    const addr = `${col}1`;
    const desc = headerDescription(header as keyof User);
    const cell = ws[addr] || { t: "s", v: header };
    if (desc) {
      // SheetJS comment structure
      // a: author, t: text; you can add r for rich text if needed
      (cell as any).c = [{ a: "Template", t: desc }];
    }
    ws[addr] = cell;
  });

  const colWidths = headers.map(h => {
    if (h.toLowerCase().includes("email")) return { wch: 30 };
    if (/(phone|mobile)/i.test(h)) return { wch: 18 };
    if (/(date|id)/i.test(h)) return { wch: 16 };
    if (/(country|language|city|gender)/i.test(h)) return { wch: 14 };
    return { wch: 20 };
  });
  (ws as any)["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");

  const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
};

export const downloadCSVTemplate = (
  filename = "user-template.csv",
  includeDescriptionRow = true
) => {
  const headers = USER_KEYS as readonly string[];
  const rows: (string | null)[][] = [headers as string[]];

  if (includeDescriptionRow) {
    rows.push(headers.map(header => headerDescription(header as keyof User)));
  }

  const blob = new Blob([Papa.unparse(rows)], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, filename);
};
