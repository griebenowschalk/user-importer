import { wrap, transfer, Remote } from "comlink";
import type { FileParseResult } from "@/types";
import { checkIfExcel } from "./utils";

type Api = {
  parseFile(file: File, sheetNames?: string[]): Promise<FileParseResult>;
  parseExcelBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    sheetNames?: string[]
  ): Promise<FileParseResult>;
  getFileSheetNames(file: File): Promise<string[]>;
  downloadFile(
    rows: Record<string, unknown>[],
    fileName: string,
    format: string
  ): Promise<{ buffer: ArrayBuffer; type: string; filename: string }>;
};

let remotePromise: Promise<Remote<Api>> | null = null;

function getRemote() {
  if (!remotePromise) {
    remotePromise = (async () => {
      const worker = new Worker(
        new URL("@/workers/parser.worker.ts", import.meta.url),
        { type: "module" }
      );
      return wrap<Api>(worker);
    })();
  }
  return remotePromise;
}

/**
 * Optimized file parsing
 *
 * Small files (< 5MB): The overhead of arrayBuffer() + Comlink.transfer() is higher than just sending the File object
 * Large files (> 5MB): Memory savings and transfer speed outweigh the setup overhead
 * CSV/JSON: These are text-based, so structured clone is fast enough
 *
 * Structured clone duplicates memory for ArrayBuffer (main + worker).
 * transfer(buffer, [buffer]) moves ownership into worker (no copy), cutting memory and transfer time for big XLS/XLSX (10–50MB).
 *
 * @param file - The file to parse
 * @returns The parsed file
 */
export async function parseFileOptimized(file: File, sheetNames?: string[]) {
  const remote = await getRemote();

  // For Excel files, check size and route accordingly
  if (checkIfExcel(file.name)) {
    if (file.size > 5 * 1024 * 1024) {
      // 5MB threshold
      // Large file: zero-copy path
      // Sending buffer (with transfer) to the worker is faster and more
      // memory-efficient for large files because it avoids duplicating the file in memory (zero-copy),
      // while sending the File object would require structured cloning, which is slower and uses more memory.
      const buffer = await file.arrayBuffer();
      return remote.parseExcelBuffer(
        transfer(buffer, [buffer]),
        file.name,
        sheetNames
      );
    } else {
      // Small file: regular path (avoid overhead)
      return remote.parseFile(file, sheetNames);
    }
  } else {
    // CSV/JSON: always regular path
    return remote.parseFile(file);
  }
}

export async function getFileSheetNames(file: File) {
  const remote = await getRemote();
  return remote.getFileSheetNames(file);
}

export async function downloadFile(
  rows: Record<string, unknown>[],
  fileName: string,
  format: string
) {
  const remote = await getRemote();
  const { buffer, type, filename } = await remote.downloadFile(
    rows,
    fileName,
    format
  );

  const blob = new Blob([buffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
