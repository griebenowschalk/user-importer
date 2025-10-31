import { vi } from "vitest";

const OriginalCreateObjectURL = URL.createObjectURL;
const OriginalRevokeObjectURL = URL.revokeObjectURL;
const realCreate = document.createElement;

export function installURLMocks() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:fake"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = realCreate.call(document, tag);
    if (tag === "a")
      vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {});
    return el;
  });
}

export function restoreURLMocks() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: OriginalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: OriginalRevokeObjectURL,
  });
  vi.restoreAllMocks();
}
