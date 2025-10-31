import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rowHookRegistry } from "@/lib/validationHooks";

vi.mock("@/lib/utils", () => {
  return {
    checkValidNumberCore: vi.fn(),
    numberUpdate: vi.fn(),
  };
});

import { checkValidNumberCore, numberUpdate } from "@/lib/utils";

describe("validationHooks rowHookRegistry.onEntryInit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("copies mobileNumber into workPhoneNumber if work is empty and mobile valid", () => {
    (checkValidNumberCore as any).mockReturnValue({ valid: true });

    const row = {
      email: "user@example.com",
      country: "ZAF",
      mobileNumber: "+27821234567",
      workPhoneNumber: "",
    };

    const [updated, errors] = rowHookRegistry.onEntryInit(row, false);

    expect(updated.workPhoneNumber).toBe("+27821234567");
    expect(errors).toEqual([]);
  });

  it("validates email domain and emits error for disallowed TLDs", () => {
    (checkValidNumberCore as any).mockReturnValue({ valid: true });

    const row = {
      email: "user@notallowed.xyz",
      country: "ZAF",
      mobileNumber: "+27821234567",
    };

    const [updated, errors] = rowHookRegistry.onEntryInit(row, false);

    expect(updated).toBeTruthy();
    expect(errors.some(e => e.field === "email")).toBe(true);
  });

  it("normalizes invalid phone via numberUpdate and returns error; applies when cleanUp=true", () => {
    // Baseline check for initial number
    (checkValidNumberCore as any)
      .mockReturnValueOnce({ valid: true, callingCode: "27" }) // baseline for mobile/work
      .mockReturnValueOnce({ valid: false, numberCallingCode: "1" }) // workPhoneNumber invalid
      .mockReturnValueOnce({ valid: false, numberCallingCode: "1" }); // mobileNumber invalid

    (numberUpdate as any).mockReturnValueOnce({
      newNumber: "+2723456789",
      error: { field: "workPhoneNumber", message: "invalid work number" },
    });

    (numberUpdate as any).mockReturnValueOnce({
      newNumber: "+27821234567",
      error: { field: "mobileNumber", message: "invalid mobile number" },
    });

    const row = {
      email: "user@example.com",
      country: "ZAF",
      workPhoneNumber: "+1 234 567 89",
      mobileNumber: "+1 111 111 111",
    };

    const [updatedWithCleanup, errorsWithCleanup] = rowHookRegistry.onEntryInit(
      row,
      true
    );

    expect(errorsWithCleanup).toEqual([
      { field: "workPhoneNumber", message: "invalid work number" },
      { field: "mobileNumber", message: "invalid mobile number" },
    ]);
    expect(updatedWithCleanup.workPhoneNumber).toBe("+2723456789");
    expect(updatedWithCleanup.mobileNumber).toBe("+27821234567");
  });
});
