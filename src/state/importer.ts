import { createMachine, assign } from "xstate";
import type { FileParseResult, User, ValidationError } from "@/types";

interface Ctx {
  fileData: FileParseResult | null;
  sheetNames: string[];
  file: File | null;
  headerMappings: Record<string, keyof User>;
  validatedData: { valid: any[]; errors: ValidationError[] } | null;
}

type EventPayloads = {
  FILE_PARSED: FileParseResult;
  SHEET_SELECTION: { sheetNames: string[]; file: File };
  MAPPED: Record<string, keyof User>;
  VALIDATED: { valid: any[]; errors: ValidationError[] };
  BACK: undefined;
  DONE: undefined;
};

// derive `Ev` so events with no payload omit `data`
type Ev = {
  [K in keyof EventPayloads]: EventPayloads[K] extends undefined
    ? { type: K }
    : { type: K; data: EventPayloads[K] };
}[keyof EventPayloads];

export const importerMachine = createMachine({
  id: "importer",
  initial: "upload",
  types: {} as {
    context: Ctx;
    events: Ev;
  },
  context: {
    fileData: null,
    sheetNames: [],
    file: null,
    headerMappings: {},
    validatedData: null,
  },
  states: {
    upload: {
      on: {
        FILE_PARSED: {
          target: "mapping",
          actions: assign(({ event }) => ({
            fileData: event.data,
          })),
        },
        SHEET_SELECTION: {
          target: "sheetSelect",
          actions: assign(({ event }) => ({
            sheetNames: event.data.sheetNames,
            file: event.data.file,
          })),
        },
      },
    },
    sheetSelect: {
      on: {
        BACK: "upload",
        FILE_PARSED: {
          target: "mapping",
          actions: assign(({ event }) => ({
            fileData: event.data,
          })),
        },
      },
    },
    mapping: {
      on: {
        BACK: "upload",
        MAPPED: {
          target: "preview",
          actions: assign(({ event }) => ({
            headerMappings: event.data,
          })),
        },
      },
    },
    preview: {
      on: {
        BACK: "mapping",
        VALIDATED: {
          target: "import",
          actions: assign(({ event }) => ({
            validatedData: event.data,
          })),
        },
      },
    },
    import: {
      on: {
        BACK: "preview",
        DONE: {
          target: "upload",
          actions: assign({
            fileData: null,
            headerMappings: {},
            validatedData: null,
            sheetNames: [],
            file: null,
          }),
        },
      },
    },
  },
});
