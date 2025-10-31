import { createActor } from "xstate";
import { importerMachine } from "../importer";
import { describe, it, expect } from "vitest";
import type { FileParseResult, User } from "../../types";

const mockFileData: FileParseResult = {
  headers: ["firstName"],
  rows: [{ firstName: "John" }],
  totalRows: 1,
  fileType: "csv",
  columnMapping: { mapped: {}, unmapped: [], allMappings: {} },
};

const mockFile = new File([], "test.xlsx");

describe("importerMachine", () => {
  it("starts in upload state", () => {
    const actor = createActor(importerMachine).start();
    expect(actor.getSnapshot().value).toBe("upload");
  });

  it("transitions to mapping on FILE_PARSED from upload", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    expect(actor.getSnapshot().value).toBe("mapping");
    expect(actor.getSnapshot().context.fileData).toBe(mockFileData);
  });

  it("transitions to sheetSelect on SHEET_SELECTION from upload", () => {
    const actor = createActor(importerMachine).start();
    actor.send({
      type: "SHEET_SELECTION",
      data: { sheetNames: ["Sheet1"], file: mockFile },
    });
    expect(actor.getSnapshot().value).toBe("sheetSelect");
    expect(actor.getSnapshot().context.sheetNames).toEqual(["Sheet1"]);
    expect(actor.getSnapshot().context.file).toBe(mockFile);
  });

  it("transitions back to upload on BACK from sheetSelect", () => {
    const actor = createActor(importerMachine).start();
    actor.send({
      type: "SHEET_SELECTION",
      data: { sheetNames: ["Sheet1"], file: mockFile },
    });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("upload");
  });

  it("transitions to mapping on FILE_PARSED from sheetSelect", () => {
    const actor = createActor(importerMachine).start();
    actor.send({
      type: "SHEET_SELECTION",
      data: { sheetNames: ["Sheet1"], file: mockFile },
    });
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    expect(actor.getSnapshot().value).toBe("mapping");
    expect(actor.getSnapshot().context.fileData).toBe(mockFileData);
  });

  it("transitions back to upload on BACK from mapping", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("upload");
  });

  it("transitions to preview on MAPPED from mapping", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    const mappings = { firstName: "firstName" as keyof User };
    actor.send({ type: "MAPPED", data: mappings });
    expect(actor.getSnapshot().value).toBe("preview");
    expect(actor.getSnapshot().context.headerMappings).toBe(mappings);
  });

  it("transitions back to mapping on BACK from preview", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    actor.send({
      type: "MAPPED",
      data: { firstName: "firstName" as keyof User },
    });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("mapping");
  });

  it("transitions to import on VALIDATED from preview", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    actor.send({
      type: "MAPPED",
      data: { firstName: "firstName" as keyof User },
    });
    const validatedData = {
      valid: [{ firstName: "John" }],
      errors: [],
    };
    actor.send({ type: "VALIDATED", data: validatedData });
    expect(actor.getSnapshot().value).toBe("import");
    expect(actor.getSnapshot().context.validatedData).toBe(validatedData);
  });

  it("transitions back to preview on BACK from import", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    actor.send({
      type: "MAPPED",
      data: { firstName: "firstName" as keyof User },
    });
    actor.send({
      type: "VALIDATED",
      data: { valid: [{ firstName: "John" }], errors: [] },
    });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("preview");
  });

  it("transitions to upload and resets context on DONE from import", () => {
    const actor = createActor(importerMachine).start();
    actor.send({ type: "FILE_PARSED", data: mockFileData });
    actor.send({
      type: "MAPPED",
      data: { firstName: "firstName" as keyof User },
    });
    actor.send({
      type: "VALIDATED",
      data: { valid: [{ firstName: "John" }], errors: [] },
    });
    actor.send({ type: "DONE" });
    expect(actor.getSnapshot().value).toBe("upload");
    expect(actor.getSnapshot().context.fileData).toBeNull();
    expect(actor.getSnapshot().context.headerMappings).toEqual({});
    expect(actor.getSnapshot().context.validatedData).toBeNull();
    expect(actor.getSnapshot().context.sheetNames).toEqual([]);
    expect(actor.getSnapshot().context.file).toBeNull();
  });
});
