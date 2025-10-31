import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileUpload from "@/components/FileUpload";
import type { FileParseResult } from "@/types";

vi.mock("@/lib/templates", () => ({
  downloadExcelTemplate: vi.fn(),
  downloadCSVTemplate: vi.fn(),
}));

vi.mock("@/lib/workerClient", () => ({
  parseFileOptimized: vi.fn(),
  getFileSheetNames: vi.fn(),
}));

vi.mock("@/lib/utils", async orig => {
  const actual = (await orig()) as any;
  return {
    ...actual,
    checkIfExcel: vi.fn(),
  };
});

let worker: typeof import("@/lib/workerClient");
let utils: typeof import("@/lib/utils");
let templates: typeof import("@/lib/templates");

const getInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(async () => {
  vi.resetAllMocks();
  worker = await import("@/lib/workerClient");
  utils = await import("@/lib/utils");
  templates = await import("@/lib/templates");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FileUpload", () => {
  it("triggers template downloads", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    render(<FileUpload onFileUploaded={onFileUploaded} />);

    const excelBtn = screen.getByRole("button", { name: /Excel Template/i });
    const csvBtn = screen.getByRole("button", { name: /CSV Template/i });
    await user.click(excelBtn);
    await user.click(csvBtn);

    expect(templates.downloadExcelTemplate).toHaveBeenCalled();
    expect(templates.downloadCSVTemplate).toHaveBeenCalled();
  });

  it("uploads a file successfully (CSV) and shows loading state during parse", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();

    vi.mocked(utils.checkIfExcel).mockReturnValue(null);

    let resolveParse: (v: FileParseResult) => void;
    const parsePromise = new Promise<FileParseResult>(res => {
      resolveParse = res;
    });
    vi.mocked(worker.parseFileOptimized).mockReturnValue(parsePromise as any);

    const { container } = render(
      <FileUpload onFileUploaded={onFileUploaded} />
    );

    const file = new File(["a,b\n1,2"], "users.csv", { type: "text/csv" });
    const input = getInput(container);

    await user.upload(input, file);

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();

    resolveParse!({
      rows: [],
      headers: [],
      totalRows: 0,
      fileType: "csv",
      columnMapping: { mapped: {}, unmapped: [], allMappings: {} },
    });

    await screen.findByText(/Upload File/i);

    expect(onFileUploaded).toHaveBeenCalledWith({
      rows: [],
      headers: [],
      totalRows: 0,
      fileType: "csv",
      columnMapping: { mapped: {}, unmapped: [], allMappings: {} },
    });

    expect(screen.queryByText(/Loading.../i)).toBeNull();
  });

  it("shows error dialog when parsing fails", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();

    vi.mocked(utils.checkIfExcel).mockReturnValue(null);
    vi.mocked(worker.parseFileOptimized).mockRejectedValue(new Error("Boom"));

    const { container } = render(
      <FileUpload onFileUploaded={onFileUploaded} />
    );

    const file = new File(["{}"], "users.json", {
      type: "application/json",
    });
    const input = getInput(container);

    await user.upload(input, file);

    expect(await screen.findByText(/Boom/i)).toBeInTheDocument();
    expect(onFileUploaded).not.toHaveBeenCalled();
  });

  it("when Excel with multiple sheets, calls onSheetSelected and does not parse", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    const onSheetSelected = vi.fn();

    vi.mocked(utils.checkIfExcel).mockReturnValue([".xlsx"]);
    vi.mocked(worker.getFileSheetNames).mockResolvedValue(["Sheet1", "Sheet2"]);

    const { container } = render(
      <FileUpload
        onFileUploaded={onFileUploaded}
        onSheetSelected={onSheetSelected}
      />
    );

    const file = new File([""], "users.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = getInput(container);

    await user.upload(input, file);

    expect(onSheetSelected).toHaveBeenCalledWith(
      ["Sheet1", "Sheet2"],
      expect.any(File)
    );
    expect(worker.parseFileOptimized).not.toHaveBeenCalled();
  });
});
