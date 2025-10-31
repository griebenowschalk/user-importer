import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SheetSelection from "@/components/SheetSelection";
import type { FileParseResult } from "@/types";

vi.mock("@/lib/workerClient", () => ({
  parseFileOptimized: vi.fn(),
}));

let worker: typeof import("@/lib/workerClient");

beforeEach(async () => {
  vi.resetAllMocks();
  worker = await import("@/lib/workerClient");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SheetSelection", () => {
  const file = new File([""], "users.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  it("renders sheet names and disables Next until one is selected", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    const onBack = vi.fn();

    render(
      <SheetSelection
        onFileUploaded={onFileUploaded}
        onBack={onBack}
        sheetNames={["Sheet1", "Sheet2"]}
        file={file}
      />
    );

    expect(screen.getByText(/Select a sheet/i)).toBeInTheDocument();
    expect(screen.getByText("Sheet1")).toBeInTheDocument();
    expect(screen.getByText("Sheet2")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).toBeDisabled();

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(nextBtn).not.toBeDisabled();
  });

  it("calls parseFileOptimized with selected sheet and forwards result", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    const onBack = vi.fn();

    const result: FileParseResult = {
      rows: [],
      headers: [],
      totalRows: 0,
      fileType: "xlsx",
      columnMapping: { mapped: {}, unmapped: [], allMappings: {} },
    };

    vi.mocked(worker.parseFileOptimized).mockResolvedValue(result);

    render(
      <SheetSelection
        onFileUploaded={onFileUploaded}
        onBack={onBack}
        sheetNames={["Sheet1", "Sheet2"]}
        file={file}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: /Next/i }));

    expect(worker.parseFileOptimized).toHaveBeenCalledWith(file, ["Sheet2"]);
    expect(onFileUploaded).toHaveBeenCalledWith(result);
  });

  it("shows error dialog when parse fails", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    const onBack = vi.fn();

    vi.mocked(worker.parseFileOptimized).mockRejectedValue(
      new Error("Parse failed")
    );

    render(
      <SheetSelection
        onFileUploaded={onFileUploaded}
        onBack={onBack}
        sheetNames={["A"]}
        file={file}
      />
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Parse failed/i)).toBeInTheDocument();
    expect(onFileUploaded).not.toHaveBeenCalled();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    const onBack = vi.fn();

    render(
      <SheetSelection
        onFileUploaded={onFileUploaded}
        onBack={onBack}
        sheetNames={["A"]}
        file={file}
      />
    );

    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
