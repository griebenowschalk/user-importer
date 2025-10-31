import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import type { FileParseResult, User } from "@/types";

const mockFileUpload = vi.fn();
const mockHeaderMapping = vi.fn();
const mockDataPreview = vi.fn();
const mockImportProgress = vi.fn();
const mockSheetSelection = vi.fn();

const FileUploadComponent = (props: {
  onFileUploaded: (data: FileParseResult) => void;
  onSheetSelected: (sheetNames: string[], file: File) => void;
}) => {
  mockFileUpload(props);
  return (
    <div data-testid="file-upload">
      <button onClick={() => props.onFileUploaded(mockFileData)}>Upload</button>
      <button
        onClick={() =>
          props.onSheetSelected(["Sheet1", "Sheet2"], new File([], "test.xlsx"))
        }
      >
        Sheet Select
      </button>
    </div>
  );
};

const HeaderMappingComponent = (props: {
  fileData: FileParseResult;
  onNext: (mappings: Record<string, keyof User>) => void;
  onBack: () => void;
}) => {
  mockHeaderMapping(props);
  return (
    <div data-testid="header-mapping">
      <button
        onClick={() => props.onNext({ firstName: "firstName" as keyof User })}
      >
        Next
      </button>
      <button onClick={() => props.onBack()}>Back</button>
    </div>
  );
};

const DataPreviewComponent = (props: {
  fileData: FileParseResult;
  mappings: Record<string, keyof User>;
  onNext: (data: { valid: unknown[]; errors: unknown[] }) => void;
  onBack: () => void;
}) => {
  mockDataPreview(props);
  return (
    <div data-testid="data-preview">
      <button
        onClick={() =>
          props.onNext({ valid: [{ firstName: "John" }], errors: [] })
        }
      >
        Next
      </button>
      <button onClick={() => props.onBack()}>Back</button>
    </div>
  );
};

const ImportProgressComponent = (props: {
  data: { valid: unknown[]; errors: unknown[] };
  onBack: () => void;
}) => {
  mockImportProgress(props);
  return (
    <div data-testid="import-progress">
      <button onClick={() => props.onBack()}>Back</button>
    </div>
  );
};

const SheetSelectionComponent = (props: {
  sheetNames: string[];
  file: File;
  onFileUploaded: (data: FileParseResult) => void;
  onBack: () => void;
}) => {
  mockSheetSelection(props);
  return (
    <div data-testid="sheet-selection">
      <button onClick={() => props.onFileUploaded(mockFileData)}>Upload</button>
      <button onClick={() => props.onBack()}>Back</button>
    </div>
  );
};

vi.mock("../components/FileUpload", () => {
  return {
    __esModule: true,
    default: FileUploadComponent,
  };
});

vi.mock("../components/HeaderMapping", () => {
  return {
    __esModule: true,
    default: HeaderMappingComponent,
  };
});

vi.mock("../components/DataPreview", () => {
  return {
    __esModule: true,
    default: DataPreviewComponent,
  };
});

vi.mock("../components/ImportProgress", () => {
  return {
    __esModule: true,
    default: ImportProgressComponent,
  };
});

vi.mock("../components/SheetSelection", () => {
  return {
    __esModule: true,
    default: SheetSelectionComponent,
  };
});

const mockFileData: FileParseResult = {
  headers: ["firstName"],
  rows: [{ firstName: "John" }],
  totalRows: 1,
  fileType: "csv",
  columnMapping: {
    mapped: {},
    unmapped: [],
    allMappings: {},
  },
};

const mockSend = vi.fn();
const mockMatches = vi.fn((state: string) => state === "upload");
const mockState = {
  matches: mockMatches,
  context: {
    fileData: null as FileParseResult | null,
    headerMappings: {} as Record<string, keyof User>,
    validatedData: null as { valid: unknown[]; errors: unknown[] } | null,
    file: null as File | null,
    sheetNames: [] as string[],
  },
};

vi.mock("@xstate/react", () => ({
  useMachine: vi.fn(() => [mockState, mockSend]),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatches.mockImplementation((state: string) => state === "upload");
    mockState.context.fileData = null;
    mockState.context.headerMappings = {};
    mockState.context.validatedData = null;
    mockState.context.file = null;
    mockState.context.sheetNames = [];
  });

  it("renders header and initial upload state", async () => {
    render(<App />);

    expect(screen.getByText("User Importer")).toBeInTheDocument();
    expect(
      screen.getByText("Import users from CSV, Excel, or JSON files")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });
  });

  it("renders FileUpload component in upload state", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    expect(mockFileUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        onFileUploaded: expect.any(Function),
        onSheetSelected: expect.any(Function),
      })
    );
  });

  it("sends FILE_PARSED event when FileUpload calls onFileUploaded", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    const uploadBtn = screen.getByText("Upload");
    await userEvent.click(uploadBtn);

    expect(mockSend).toHaveBeenCalledWith({
      type: "FILE_PARSED",
      data: mockFileData,
    });
  });

  it("sends SHEET_SELECTION event when FileUpload calls onSheetSelected", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    const sheetSelectBtn = screen.getByText("Sheet Select");
    await userEvent.click(sheetSelectBtn);

    expect(mockSend).toHaveBeenCalledWith({
      type: "SHEET_SELECTION",
      data: {
        sheetNames: ["Sheet1", "Sheet2"],
        file: expect.any(File),
      },
    });
  });

  it("renders SheetSelection component in sheetSelect state", async () => {
    mockMatches.mockImplementation((state: string) => state === "sheetSelect");
    mockState.context.sheetNames = ["Sheet1", "Sheet2"];
    mockState.context.file = new File([], "test.xlsx") as File | null;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sheet-selection")).toBeInTheDocument();
    });
    expect(mockSheetSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetNames: ["Sheet1", "Sheet2"],
        file: expect.any(File),
        onFileUploaded: expect.any(Function),
        onBack: expect.any(Function),
      })
    );
  });

  it("sends BACK event from SheetSelection", async () => {
    mockMatches.mockImplementation((state: string) => state === "sheetSelect");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sheet-selection")).toBeInTheDocument();
    });

    const backBtn = screen.getByText("Back");
    await userEvent.click(backBtn);

    expect(mockSend).toHaveBeenCalledWith({ type: "BACK" });
  });

  it("renders HeaderMapping component in mapping state", async () => {
    mockMatches.mockImplementation((state: string) => state === "mapping");
    mockState.context.fileData = mockFileData;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("header-mapping")).toBeInTheDocument();
    });
    expect(mockHeaderMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        fileData: mockFileData,
        onNext: expect.any(Function),
        onBack: expect.any(Function),
      })
    );
  });

  it("sends MAPPED event when HeaderMapping calls onNext", async () => {
    mockMatches.mockImplementation((state: string) => state === "mapping");
    mockState.context.fileData = mockFileData;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("header-mapping")).toBeInTheDocument();
    });

    const nextBtn = screen.getByText("Next");
    await userEvent.click(nextBtn);

    expect(mockSend).toHaveBeenCalledWith({
      type: "MAPPED",
      data: { firstName: "firstName" },
    });
  });

  it("sends BACK event from HeaderMapping", async () => {
    mockMatches.mockImplementation((state: string) => state === "mapping");
    mockState.context.fileData = mockFileData;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("header-mapping")).toBeInTheDocument();
    });

    const backBtn = screen.getByText("Back");
    await userEvent.click(backBtn);

    expect(mockSend).toHaveBeenCalledWith({ type: "BACK" });
  });

  it("renders DataPreview component in preview state", async () => {
    mockMatches.mockImplementation((state: string) => state === "preview");
    mockState.context.fileData = mockFileData;
    mockState.context.headerMappings = { firstName: "firstName" };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("data-preview")).toBeInTheDocument();
    });
    expect(mockDataPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        fileData: mockFileData,
        mappings: { firstName: "firstName" },
        onNext: expect.any(Function),
        onBack: expect.any(Function),
      })
    );
  });

  it("sends VALIDATED event when DataPreview calls onNext", async () => {
    mockMatches.mockImplementation((state: string) => state === "preview");
    mockState.context.fileData = mockFileData;
    mockState.context.headerMappings = { firstName: "firstName" };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("data-preview")).toBeInTheDocument();
    });

    const nextBtn = screen.getByText("Next");
    await userEvent.click(nextBtn);

    expect(mockSend).toHaveBeenCalledWith({
      type: "VALIDATED",
      data: { valid: [{ firstName: "John" }], errors: [] },
    });
  });

  it("sends BACK event from DataPreview", async () => {
    mockMatches.mockImplementation((state: string) => state === "preview");
    mockState.context.fileData = mockFileData;
    mockState.context.headerMappings = { firstName: "firstName" };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("data-preview")).toBeInTheDocument();
    });

    const backBtn = screen.getByText("Back");
    await userEvent.click(backBtn);

    expect(mockSend).toHaveBeenCalledWith({ type: "BACK" });
  });

  it("renders ImportProgress component in import state", async () => {
    mockMatches.mockImplementation((state: string) => state === "import");
    mockState.context.validatedData = {
      valid: [{ firstName: "John" }],
      errors: [],
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("import-progress")).toBeInTheDocument();
    });
    expect(mockImportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          valid: [{ firstName: "John" }],
          errors: [],
        },
        onBack: expect.any(Function),
      })
    );
  });

  it("sends BACK event from ImportProgress", async () => {
    mockMatches.mockImplementation((state: string) => state === "import");
    mockState.context.validatedData = {
      valid: [{ firstName: "John" }],
      errors: [],
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("import-progress")).toBeInTheDocument();
    });

    const backBtn = screen.getByText("Back");
    await userEvent.click(backBtn);

    expect(mockSend).toHaveBeenCalledWith({ type: "BACK" });
  });

  it("does not render HeaderMapping when fileData is null", () => {
    mockMatches.mockImplementation((state: string) => state === "mapping");
    mockState.context.fileData = null;

    render(<App />);

    expect(screen.queryByTestId("header-mapping")).not.toBeInTheDocument();
  });

  it("does not render DataPreview when fileData or headerMappings are null", () => {
    mockMatches.mockImplementation((state: string) => state === "preview");
    mockState.context.fileData = null;
    mockState.context.headerMappings = {};

    render(<App />);

    expect(screen.queryByTestId("data-preview")).not.toBeInTheDocument();
  });

  it("does not render ImportProgress when validatedData is null", () => {
    mockMatches.mockImplementation((state: string) => state === "import");
    mockState.context.validatedData = null;

    render(<App />);

    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
  });

  it.skip("shows Suspense fallback while components load", async () => {
    mockMatches.mockImplementation((state: string) => state === "upload");

    vi.doMock("../components/FileUpload", () => ({
      __esModule: true,
      default: () => {
        return new Promise(() => {});
      },
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });
});
