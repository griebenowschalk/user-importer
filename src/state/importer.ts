import { createMachine, assign } from "xstate";
import type {
  FileParseResult,
  HeaderMapping,
  ImportResult,
  ValidationError,
} from "@/types";

interface Ctx {
  fileData: FileParseResult | null;
  headerMappings: HeaderMapping[];
  validatedData: { valid: any[]; errors: ValidationError[] } | null;
  importProgress: ImportResult | null;
}

type EventPayloads = {
  FILE_PARSED: FileParseResult;
  MAPPED: HeaderMapping[];
  VALIDATED: { valid: any[]; errors: ValidationError[] };
  PROGRESS: ImportResult;
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
    headerMappings: [],
    validatedData: null,
    importProgress: null,
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
        PROGRESS: {
          actions: assign(({ event }) => ({
            importProgress: event.data,
          })),
        },
        DONE: {
          target: "upload",
          actions: assign({
            fileData: null,
            headerMappings: [],
            validatedData: null,
            importProgress: null,
          }),
        },
      },
    },
  },
});
