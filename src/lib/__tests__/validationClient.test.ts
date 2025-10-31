import { wrap, proxy } from "comlink";
import {
  validateRowsOptimized,
  validateChunkOptimized,
} from "@/lib/validationClient";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

vi.mock("comlink", () => ({
  wrap: vi.fn(() => fakeRemote),
  proxy: vi.fn(fn => fn),
}));
global.Worker = vi.fn() as any;

const fakeRemote = {
  validateInit: vi.fn().mockResolvedValue(undefined),
  validateAll: vi.fn().mockResolvedValue({ total: 1, processed: 1 }),
  validateChunk: vi.fn().mockResolvedValue({ startRow: 0, rows: [] }),
};

describe("validationClient", () => {
  beforeEach(() => {
    (wrap as Mock).mockReturnValue(fakeRemote);
    (global.Worker as unknown as Mock).mockClear();
    Object.values(fakeRemote).forEach(fn => (fn as any).mockClear?.());
  });

  it("wrap called once (cache) across multiple calls", async () => {
    await validateRowsOptimized([], { email: "email" });
    await validateChunkOptimized([], 0);
    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(wrap).toHaveBeenCalledTimes(1);
  });

  it("validateRowsOptimized calls init then all with proxied progress", async () => {
    const onProgress = vi.fn();
    await validateRowsOptimized([{ a: 1 }], { email: "email" }, onProgress);
    expect(fakeRemote.validateInit).toHaveBeenCalledWith({ email: "email" });
    expect(proxy).toHaveBeenCalledWith(onProgress);
    expect(fakeRemote.validateAll).toHaveBeenCalledWith(
      [{ a: 1 }],
      { email: "email" },
      onProgress
    );
  });

  it("validateChunkOptimized forwards args", async () => {
    await validateChunkOptimized([{ a: 1 }], 10, { email: "email" });
    expect(fakeRemote.validateChunk).toHaveBeenCalledWith([{ a: 1 }], 10, {
      email: "email",
    });
  });
});
