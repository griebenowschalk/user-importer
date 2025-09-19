import { wrap, Remote, proxy } from "comlink";
import type {
  ValidationProgress,
  User,
  ValidationChunk,
  RowData,
} from "../types";

type Api = {
  validateInit(mapping: Record<string, keyof User>): Promise<void>;
  validateAll(
    rawRows: RowData[],
    mapping: Record<string, keyof User>,
    onProgress?: (progress: ValidationProgress) => void
  ): Promise<ValidationProgress>;
  validateChunk(
    rawRows: RowData[],
    startRow: number,
    mapping?: Record<string, keyof User>
  ): Promise<ValidationChunk>;
};

let remotePromise: Promise<Remote<Api>> | null = null;

function getRemote() {
  if (!remotePromise) {
    remotePromise = (async () => {
      const worker = new Worker(
        new URL("@/workers/validation.worker.ts", import.meta.url),
        { type: "module" }
      );
      return wrap<Api>(worker);
    })();
  }
  return remotePromise;
}

export async function validateRowsOptimized(
  rawRows: RowData[],
  mapping: Record<string, keyof User>,
  onProgress?: (progress: ValidationProgress) => void
) {
  const remote = await getRemote();
  await remote.validateInit(mapping);
  return remote.validateAll(
    rawRows,
    mapping,
    onProgress ? proxy(onProgress) : undefined
  );
}

export async function validateChunkOptimized(
  rawRows: RowData[],
  startRow: number,
  mapping?: Record<string, keyof User>
) {
  const remote = await getRemote();
  return remote.validateChunk(rawRows, startRow, mapping);
}
