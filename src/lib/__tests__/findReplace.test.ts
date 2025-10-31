import { describe, it, expect, vi } from "vitest";
import { computeMatches, bulkFindReplace } from "@/lib/findReplace";
import type { RowData, CleaningResult, ValidationChunk, User } from "@/types";

describe("findReplace lib", () => {
  it("computeMatches finds keys in all fields and specific field", () => {
    const data: RowData[] = [
      { firstName: "Alice", email: "alice@example.com" },
      { firstName: "Bob", email: "bob@test.com" },
    ];
    const regex = /alice/i;

    const all = computeMatches(data, "all", regex);
    expect(all.has("0:firstName")).toBe(true);
    expect(all.has("0:email")).toBe(true);
    expect(all.has("1:firstName")).toBe(false);

    const fieldOnly = computeMatches(data, "email", /test\.com/i);
    expect(fieldOnly.has("1:email")).toBe(true);
    expect(fieldOnly.size).toBe(1);
  });

  it("bulkFindReplace mutates rows using validateChunk and returns grouped results", async () => {
    const data: RowData[] = [
      { email: "a@example.com" },
      { email: "b@example.com" },
      { email: "c@test.com" },
    ];
    const fileDataRows = data.map(r => ({ ...r }));

    const rows: CleaningResult = { rows: data, errors: [], changes: [] };

    const mappings: Record<string, keyof User> = { email: "email" } as any;

    const validateChunk = vi.fn(
      async (
        rowsArg: RowData[],
        startRow: number
      ): Promise<ValidationChunk> => {
        const replaced = rowsArg.map(r => ({ ...r }));
        for (const r of replaced) {
          if (typeof r.email === "string") {
            (r as any).email = (r as any).email.replace(
              /example\.com/i,
              "company.com"
            );
          }
        }
        return {
          startRow,
          endRow: startRow + rowsArg.length - 1,
          rows: replaced,
          errors: [],
          changes: [],
        } as ValidationChunk;
      }
    );

    const result = await bulkFindReplace({
      data,
      rows,
      fileDataRows,
      mappings,
      find: "example.com",
      field: "email",
      replace: "company.com",
      validateChunk,
      getTableState: () => rows,
    });

    expect(result).not.toBeNull();
    expect(result!.nextRows[0]).toEqual({ email: "a@company.com" });
    expect(result!.nextRows[1]).toEqual({ email: "b@company.com" });
    expect(result!.affectedSize).toBe(2);
    expect(validateChunk).toHaveBeenCalled();
  });
});
