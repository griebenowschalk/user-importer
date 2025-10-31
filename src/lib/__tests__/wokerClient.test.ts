import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { installURLMocks, restoreURLMocks } from "@/test-utils/fileMocks";

// keep native URL constructor for: new URL(..., import.meta.url)
beforeEach(() => {
  // spy on body attach/detach
  vi.spyOn(document.body, "appendChild");
  vi.spyOn(document.body, "removeChild");
  installURLMocks();

  class MockWorker {
    constructor(..._args: any[]) {}
    postMessage(_msg: any) {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  }
  vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);

  // polyfill File.prototype.arrayBuffer if missing and fallback to FileReader
  if (!(File.prototype as any).arrayBuffer) {
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      writable: true,
      value: async function () {
        if (typeof (Blob.prototype as any).arrayBuffer === "function") {
          return await (Blob.prototype as any).arrayBuffer.call(this);
        }

        return await new Promise<ArrayBuffer>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(fr.error);
          fr.onload = () => resolve(fr.result as ArrayBuffer);
          fr.readAsArrayBuffer(this as Blob);
        });
      },
    });
  }
});

afterEach(() => {
  restoreURLMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

vi.mock("comlink", () => ({
  wrap: vi.fn(() => fakeRemote),
  transfer: vi.fn(buf => buf),
}));
vi.mock("@/lib/utils", () => ({ checkIfExcel: vi.fn() }));

const { parseFileOptimized, getFileSheetNames, downloadFile } = await import(
  "@/lib/workerClient"
);
import { checkIfExcel } from "@/lib/utils";

const fakeRemote = {
  parseFile: vi.fn().mockResolvedValue({ rows: [], headers: [] }),
  parseExcelBuffer: vi.fn().mockResolvedValue({ rows: [], headers: [] }),
  getFileSheetNames: vi.fn().mockResolvedValue(["Sheet1"]),
  downloadFile: vi.fn().mockResolvedValue({
    buffer: new Uint8Array([1, 2, 3]).buffer,
    type: "application/octet-stream",
    filename: "out.bin",
  }),
};

describe("workerClient", () => {
  it("excel large uses arrayBuffer + parseExcelBuffer", async () => {
    (checkIfExcel as Mock).mockReturnValue(true);
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "x.xlsx"); // >5MB
    const spy = vi.spyOn(bigFile, "arrayBuffer"); // ensure called
    await parseFileOptimized(bigFile, ["A"]);
    expect(spy).toHaveBeenCalled();
    expect(fakeRemote.parseExcelBuffer).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      "x.xlsx",
      ["A"]
    );
    expect(fakeRemote.parseFile).not.toHaveBeenCalled();
  });

  it("excel small calls parseFile(file, sheetNames)", async () => {
    (checkIfExcel as Mock).mockReturnValue(true);
    const small = new File([new Uint8Array(1024)], "x.xlsx");
    await parseFileOptimized(small, ["B"]);
    expect(fakeRemote.parseFile).toHaveBeenCalledWith(small, ["B"]);
  });

  it("non-excel calls parseFile(file) without sheetNames", async () => {
    (checkIfExcel as Mock).mockReturnValue(false);
    const f = new File([new Uint8Array(10)], "x.csv");
    await parseFileOptimized(f);
    expect(fakeRemote.parseFile).toHaveBeenCalledWith(f);
  });

  it("getFileSheetNames forwards to remote", async () => {
    const f = new File([new Uint8Array(10 * 1024 * 1024)], "x.xlsx"); // >10MB
    const sheets = await getFileSheetNames(f);
    expect(sheets).toEqual(["Sheet1"]);
    expect(fakeRemote.getFileSheetNames).toHaveBeenCalledWith(f);
  });

  it("downloadFile builds Blob, clicks anchor, revokes URL after timeout", async () => {
    vi.useFakeTimers();
    await downloadFile([{ a: 1 }], "x", "csv");
    const a = (document.body.appendChild as any).mock
      .calls[0][0] as HTMLAnchorElement;
    expect(a.download).toBe("out.bin");
    expect(a.href).toBe("blob:fake");
    expect((a.click as any).mock.calls.length).toBe(1);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(document.body.removeChild).toHaveBeenCalledWith(a);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
