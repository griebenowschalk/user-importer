import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { downloadCSVTemplate, downloadExcelTemplate } from "@/lib/templates";
import Papa from "papaparse";
import { installURLMocks, restoreURLMocks } from "@/test-utils/fileMocks";

vi.mock("@/types", () => ({
  USER_KEYS: [
    "firstName",
    "email",
    "startDate",
    "country",
    "mobileNumber",
  ] as const,
}));

vi.mock("@/localisation/fields", () => ({
  fields: {
    firstName_description: "Given name",
    email_description: "Work email",
    startDate_description: "Start date",
    country_description: "Country",
    mobileNumber_description: "Mobile number",
  },
}));

vi.mock("xlsx", () => {
  const utils = {
    json_to_sheet: vi.fn(() => ({})),
    encode_col: vi.fn((i: number) => (i === 0 ? "A" : "B")),
    book_new: vi.fn(() => ({ __wb: true })),
    book_append_sheet: vi.fn(),
  };
  return {
    utils,
    write: vi.fn(() => new Uint8Array([1, 2, 3])),
  };
});

vi.mock("papaparse", () => ({
  default: { unparse: vi.fn(() => "firstName,email\n,") },
}));

describe("templates", () => {
  beforeEach(() => {
    installURLMocks();
  });

  afterEach(() => {
    restoreURLMocks();
  });

  it("excel: creates Blob, anchors to filename, clicks, cleans up", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    downloadExcelTemplate("test.xlsx");

    expect(URL.createObjectURL).toHaveBeenCalled();
    const blobArg = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    const a = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(a.download).toBe("test.xlsx");
    expect(a.href).toBe("blob:fake");
    expect((a.click as any).mock.calls.length).toBe(1);

    expect(removeSpy).toHaveBeenCalledWith(a);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("csv: constructs CSV with description row", () => {
    downloadCSVTemplate("users.csv", true);
    expect(Papa.unparse).toHaveBeenCalled();
    const rows = (Papa.unparse as any).mock.calls[0][0] as string[][];
    expect(rows.length).toBe(2);
    const blob = (URL.createObjectURL as any).mock.calls.at(-1)[0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
  });

  it("csv: omits description row when disabled", () => {
    (Papa.unparse as any).mockClear();
    downloadCSVTemplate("users.csv", false);
    const rows = (Papa.unparse as any).mock.calls[0][0] as string[][];
    expect(rows.length).toBe(1);
  });
});
