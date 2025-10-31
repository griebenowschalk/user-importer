import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeaderMapping from "@/components/HeaderMapping";
import type { FileParseResult, User } from "@/types";

vi.mock("@/lib/userColumnMatcher", () => ({
  __esModule: true,
  default: {
    getUnmappedUserFields: vi.fn(),
  },
}));

let UserColumnMatcher: typeof import("@/lib/userColumnMatcher").default;

beforeEach(async () => {
  vi.resetAllMocks();
  const mod = await import("@/lib/userColumnMatcher");
  UserColumnMatcher = mod.default;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HeaderMapping", () => {
  const makeFileData = (
    mapped: Record<string, keyof User>,
    unmapped: string[]
  ): FileParseResult => ({
    rows: [],
    headers: Object.keys(mapped).concat(unmapped),
    totalRows: 0,
    fileType: "csv",
    columnMapping: {
      mapped,
      unmapped,
      allMappings: {},
    },
  });

  it("renders mapped and unmapped sections and disables Next with no mappings", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onBack = vi.fn();

    (UserColumnMatcher.getUnmappedUserFields as Mock).mockReturnValue([
      "firstName",
      "lastName",
    ] satisfies (keyof User)[]);

    const fileData = makeFileData({}, ["First Name", "Last Name"]);

    render(
      <HeaderMapping onNext={onNext} onBack={onBack} fileData={fileData} />
    );

    expect(screen.getByText("First Name")).toBeInTheDocument();
    expect(screen.getByText("Last Name")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("maps an unmapped header via select and calls onNext with new mapping", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onBack = vi.fn();

    (UserColumnMatcher.getUnmappedUserFields as Mock).mockReturnValue([
      "firstName",
      "lastName",
      "email",
    ] satisfies (keyof User)[]);

    const fileData = makeFileData({ Email: "email" }, ["First Name"]);

    render(
      <HeaderMapping onNext={onNext} onBack={onBack} fileData={fileData} />
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getAllByText("email").length).toBeGreaterThan(0);

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "firstName");

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();

    await user.click(nextBtn);

    expect(onNext).toHaveBeenCalledWith({
      Email: "email",
      "First Name": "firstName",
    });
  });

  it("removes an existing mapping", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onBack = vi.fn();

    (UserColumnMatcher.getUnmappedUserFields as Mock).mockReturnValue([
      "firstName",
      "lastName",
    ] satisfies (keyof User)[]);

    const fileData = makeFileData({ Email: "email" }, []);

    render(
      <HeaderMapping onNext={onNext} onBack={onBack} fileData={fileData} />
    );

    await user.click(screen.getByRole("button", { name: /Remove/i }));

    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
  });
});
