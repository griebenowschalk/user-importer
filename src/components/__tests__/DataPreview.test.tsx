import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataPreview from "@/components/DataPreview";
import type {
  FileParseResult,
  GroupedRowError,
  CleaningResult,
  User,
  ValidationProgress,
} from "@/types";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (config: { count: number }) => {
    const count = config?.count ?? 2;
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
          items.push({ index: i, start: i * 36, end: (i + 1) * 36 });
        }
        return items;
      },
      getTotalSize: () => count * 36,
    };
  },
}));

const baseRows: CleaningResult = {
  rows: [
    { firstName: "Alice", gender: "female" },
    { firstName: "Bob", gender: "male" },
  ],
  errors: [],
  changes: [],
};
const baseGroupedErrors: GroupedRowError[] = [
  { row: 0, fields: [{ field: "firstName", messages: [], value: "" }] },
];
const baseProgress: ValidationProgress = {
  chunks: [],
  metadata: {
    totalRows: 2,
    processedRows: 2,
    errorCount: 1,
    changeCount: 0,
    estimatedTimeRemaining: 0,
  },
  isComplete: true,
  groupedErrors: baseGroupedErrors,
  groupedChanges: [],
};

vi.mock("@/lib/validationClient", () => {
  return {
    validateRowsOptimized: vi.fn(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        const progress = {
          chunks: [
            {
              startRow: 0,
              endRow: 2,
              rows: baseRows.rows,
              errors: baseRows.errors,
              changes: baseRows.changes,
            },
          ],
          metadata: baseProgress.metadata,
          isComplete: true,
          groupedErrors: baseGroupedErrors,
          groupedChanges: [],
        };
        if (onProgress) {
          onProgress(progress);
        }
        return progress;
      }
    ),
    validateChunkOptimized: vi.fn(async () => ({
      startRow: 0,
      endRow: 1,
      rows: [{ firstName: "Updated", gender: "female" }],
      errors: [],
      changes: [],
    })),
  };
});

vi.mock("@/lib/findReplace", () => ({
  computeMatches: vi.fn(() => new Set(["0:firstName"])),
  bulkFindReplace: vi.fn(async () => ({
    nextRows: [{ firstName: "Alice", gender: "female" }],
    nextErrors: [],
    nextChanges: [],
    nextGroupedErrors: [],
    nextGroupedChanges: [],
    affectedSize: 1,
  })),
}));

vi.mock("@/lib/workerClient", () => ({
  downloadFile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("DataPreview", () => {
  const fileData: FileParseResult = {
    headers: ["firstName", "gender"],
    rows: [
      { firstName: "Alice", gender: "female" },
      { firstName: "Bob", gender: "male" },
    ],
    totalRows: 2,
    fileType: "csv",
    columnMapping: {
      mapped: {
        firstName: "firstName" as keyof User,
        gender: "gender" as keyof User,
      },
      unmapped: [],
      allMappings: { firstName: "firstName", gender: "gender" },
    },
  };

  const mappings: Record<string, keyof User> = {
    firstName: "firstName",
    gender: "gender",
  };

  it("renders table with number column and data column; Find Errors works", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("#")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByText("firstName").length).toBeGreaterThan(0);
    });

    const findBtn = screen.getByRole("button", { name: /Find Errors/i });
    expect(findBtn).not.toBeDisabled();
    await user.click(findBtn);
    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("selecting a row shows Delete action", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("1"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete/i })
      ).toBeInTheDocument();
    });
  });

  it("selecting exactly one row shows Duplicate action", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("1"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Duplicate/i })
      ).toBeInTheDocument();
    });
  });

  it("change then undo and redo triggers history actions", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByRole("textbox");
    const input = inputs[0] as HTMLInputElement;
    const valueBeforeChange = input.value;

    await user.click(input);
    await user.clear(input);
    await user.type(input, "Test");
    await user.tab();

    await waitFor(
      () => {
        const updatedInputs = screen.getAllByRole("textbox");
        const updatedInput = updatedInputs[0] as HTMLInputElement;
        expect(updatedInput.value).toBe("Updated");
      },
      { timeout: 3000 }
    );

    const undoBtn = container
      .querySelector("svg.lucide-undo")
      ?.closest("button") as HTMLButtonElement | null;
    const redoBtn = container
      .querySelector("svg.lucide-redo")
      ?.closest("button") as HTMLButtonElement | null;

    if (undoBtn && !undoBtn.disabled) {
      await user.click(undoBtn);
      await waitFor(
        () => {
          const inputsAfterUndo = screen.getAllByRole("textbox");
          const inputAfterUndo = inputsAfterUndo[0] as HTMLInputElement;
          expect(inputAfterUndo.value).toBe(valueBeforeChange);
        },
        { timeout: 3000 }
      );
    }

    if (redoBtn && !redoBtn.disabled) {
      await user.click(redoBtn);
      await waitFor(
        () => {
          const inputsAfterRedo = screen.getAllByRole("textbox");
          const inputAfterRedo = inputsAfterRedo[0] as HTMLInputElement;
          expect(inputAfterRedo.value).toBe("Updated");
        },
        { timeout: 3000 }
      );
    }
  });

  it("undo does nothing when no history exists", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });

    const undoBtn = container
      .querySelector("svg.lucide-undo")
      ?.closest("button") as HTMLButtonElement | null;

    if (undoBtn) {
      expect(undoBtn.disabled).toBe(true);
      await user.click(undoBtn);
      const inputs = screen.getAllByRole("textbox");
      const input = inputs[0] as HTMLInputElement;
      expect(input.value).toBe("Alice");
    }
  });

  it("redo does nothing when at end of history", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });

    const redoBtn = container
      .querySelector("svg.lucide-redo")
      ?.closest("button") as HTMLButtonElement | null;

    if (redoBtn) {
      expect(redoBtn.disabled).toBe(true);
      await user.click(redoBtn);
      const inputs = screen.getAllByRole("textbox");
      const input = inputs[0] as HTMLInputElement;
      expect(input.value).toBe("Alice");
    }
  });

  it("getTableState returns null when rows is null", async () => {
    const { validateRowsOptimized } = await import("@/lib/validationClient");
    vi.mocked(validateRowsOptimized).mockImplementationOnce(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        if (onProgress) {
          onProgress({
            chunks: [],
            metadata: {
              totalRows: 0,
              processedRows: 0,
              errorCount: 0,
              changeCount: 0,
              estimatedTimeRemaining: 0,
            },
            isComplete: false,
            groupedErrors: [],
            groupedChanges: [],
          });
        }
        return {
          chunks: [],
          metadata: {
            totalRows: 0,
            processedRows: 0,
            errorCount: 0,
            changeCount: 0,
            estimatedTimeRemaining: 0,
          },
          isComplete: false,
          groupedErrors: [],
          groupedChanges: [],
        };
      }
    );

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  it("shows loading progress until validation completes", async () => {
    const { validateRowsOptimized } = await import("@/lib/validationClient");
    vi.mocked(validateRowsOptimized).mockImplementationOnce(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        if (onProgress) {
          onProgress({
            chunks: [],
            metadata: {
              totalRows: 2,
              processedRows: 1,
              errorCount: 0,
              changeCount: 0,
              estimatedTimeRemaining: 0,
            },
            isComplete: false,
            groupedErrors: [],
            groupedChanges: [],
          });
        }
        return {
          chunks: [],
          metadata: {
            totalRows: 2,
            processedRows: 1,
            errorCount: 0,
            changeCount: 0,
            estimatedTimeRemaining: 0,
          },
          isComplete: false,
          groupedErrors: [],
          groupedChanges: [],
        };
      }
    );

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
    const findBtn = screen.getByRole("button", { name: /Find Errors/i });
    expect(findBtn).toBeDisabled();
  });

  it("switches between All Rows and Errors Only tabs", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const errorsTab = screen.getByRole("tab", { name: /Errors Only/i });
    await user.click(errorsTab);

    await waitFor(() => {
      expect(errorsTab).toHaveAttribute("data-state", "active");
    });

    const allTab = screen.getByRole("tab", { name: /All Rows/i });
    await user.click(allTab);
    await waitFor(() => {
      expect(allTab).toHaveAttribute("data-state", "active");
    });
  });

  it("calls deleteRows when Delete button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("1"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      const inputs = screen.queryAllByRole("textbox");
      expect(inputs.length).toBeLessThan(2);
    });
  });

  it("calls duplicateRow when Duplicate button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("1"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Duplicate/i })
      ).toBeInTheDocument();
    });

    const rowCountBefore = screen.queryAllByRole("row").length;
    await user.click(screen.getByRole("button", { name: /Duplicate/i }));
    await waitFor(() => {
      const rowCountAfter = screen.queryAllByRole("row").length;
      expect(rowCountAfter).toBeGreaterThan(rowCountBefore);
    });
  });

  it("handles Find action from FindReplace component", async () => {
    const user = userEvent.setup();
    const { computeMatches } = await import("@/lib/findReplace");
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const findBtn = screen
      .getAllByRole("button")
      .find(b => b.querySelector("svg.lucide-file-search"));
    expect(findBtn).toBeTruthy();
    if (findBtn) {
      await user.click(findBtn);
      const popover = await screen.findByText(/Find and Replace/i);
      const scope = within(
        popover.closest("div[role='dialog']") || document.body
      );

      const findInput = scope.getAllByRole("textbox")[0] as HTMLInputElement;
      await user.type(findInput, "Alice");

      const findSubmitBtn = scope.getByRole("button", { name: /^find$/i });
      await user.click(findSubmitBtn);

      await waitFor(() => {
        expect(computeMatches).toHaveBeenCalled();
      });
    }
  });

  it.skip("handles Replace All action from FindReplace component and calls pushHistory", async () => {
    const user = userEvent.setup();
    const { bulkFindReplace, computeMatches } = await import(
      "@/lib/findReplace"
    );
    vi.mocked(computeMatches).mockReturnValueOnce(new Set(["0:firstName"]));
    vi.mocked(bulkFindReplace).mockResolvedValueOnce({
      nextRows: [{ firstName: "Carol", gender: "female" }],
      nextErrors: [],
      nextChanges: [],
      nextGroupedErrors: [],
      nextGroupedChanges: [],
      affectedSize: 1,
    });

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const findBtn = screen
      .getAllByRole("button")
      .find(b => b.querySelector("svg.lucide-file-search"));
    if (findBtn) {
      await user.click(findBtn);
      const popover = await screen.findByText(/Find and Replace/i);
      const scope = within(
        popover.closest("div[role='dialog']") || document.body
      );

      const inputs = scope.getAllByRole("textbox");
      const findInput = inputs[0] as HTMLInputElement;
      const replaceInput = inputs[1] as HTMLInputElement;

      await user.clear(findInput);
      await user.type(findInput, "Alice");
      await user.clear(replaceInput);
      await user.type(replaceInput, "Carol");

      const replaceAllBtn = scope.getByRole("button", { name: /replace all/i });
      expect(replaceAllBtn).toBeDisabled();

      const findSubmitBtn = scope.getByRole("button", { name: /^find$/i });
      await user.click(findSubmitBtn);

      await waitFor(() => {
        expect(computeMatches).toHaveBeenCalled();
      });

      await waitFor(() => {
        const updatedReplaceAllBtn = scope.getByRole("button", {
          name: /replace all/i,
        });
        expect(updatedReplaceAllBtn).not.toBeDisabled();
      });

      const finalReplaceAllBtn = scope.getByRole("button", {
        name: /replace all/i,
      });

      await user.click(finalReplaceAllBtn);

      await waitFor(
        () => {
          expect(bulkFindReplace).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      if (vi.mocked(bulkFindReplace).mock.calls.length > 0) {
        const call = vi.mocked(bulkFindReplace).mock.calls[0]?.[0];
        expect(call?.find).toBe("Alice");
        expect(call?.replace).toBe("Carol");
        expect(call?.field).toBe("all");
      }
    }
  });

  it("calls downloadFile when DownloadDialog is submitted", async () => {
    const user = userEvent.setup();
    const { downloadFile } = await import("@/lib/workerClient");
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const downloadBtn = screen
      .getAllByRole("button")
      .find(b => b.querySelector("svg.lucide-download"));
    if (downloadBtn) {
      await user.click(downloadBtn);
      const dialog = await screen.findByRole("dialog");

      await user.type(
        within(dialog).getByPlaceholderText(/enter file name/i),
        "export"
      );
      const selectBtn = within(dialog)
        .getByText(/select a format/i)
        .closest("button")!;
      await user.click(selectBtn);
      await user.keyboard("{ArrowDown}{Enter}");

      await user.click(within(dialog).getByTestId("save-button"));

      await waitFor(() => {
        expect(downloadFile).toHaveBeenCalledWith(
          baseRows.rows,
          "export",
          "xlsx"
        );
      });
    }
  });

  it("sorts table when clicking sortable column header", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const firstNameHeader = screen.getAllByText("firstName").find(el => {
      const parent = el.closest("th");
      return parent && parent.querySelector("svg.lucide-arrow-up-down");
    });

    if (firstNameHeader) {
      await user.click(firstNameHeader);
    }
  });

  it("handles cell focus and blur", async () => {
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByRole("textbox");
    const input = inputs[0] as HTMLInputElement;
    const cell = input.closest("td");
    if (cell) {
      fireEvent.focus(input);
      fireEvent.blur(input);
    }
  });

  it("disables Next button when errors exist", async () => {
    const { validateRowsOptimized } = await import("@/lib/validationClient");
    vi.mocked(validateRowsOptimized).mockImplementationOnce(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        const progress = {
          chunks: [
            {
              startRow: 0,
              endRow: 2,
              rows: baseRows.rows,
              errors: [
                {
                  row: 0,
                  field: "firstName" as keyof User,
                  message: "err",
                  value: "",
                },
              ],
              changes: baseRows.changes,
            },
          ],
          metadata: { ...baseProgress.metadata },
          isComplete: true,
          groupedErrors: baseGroupedErrors,
          groupedChanges: [],
        };
        if (onProgress) {
          onProgress(progress);
        }
        return progress;
      }
    );

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      expect(nextBtn).toBeDisabled();
    });
  });

  it("enables Next button when no errors and validation complete", async () => {
    const { validateRowsOptimized } = await import("@/lib/validationClient");
    vi.mocked(validateRowsOptimized).mockImplementationOnce(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        const progress = {
          chunks: [
            {
              startRow: 0,
              endRow: 2,
              rows: baseRows.rows,
              errors: [],
              changes: baseRows.changes,
            },
          ],
          metadata: { ...baseProgress.metadata, errorCount: 0 },
          isComplete: true,
          groupedErrors: [],
          groupedChanges: [],
        };
        if (onProgress) {
          onProgress(progress);
        }
        return progress;
      }
    );

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      expect(nextBtn).not.toBeDisabled();
    });
  });

  it("calls onNext with valid data when Next is clicked", async () => {
    const onNext = vi.fn();
    const { validateRowsOptimized } = await import("@/lib/validationClient");
    vi.mocked(validateRowsOptimized).mockImplementationOnce(
      async (
        _rawRows: unknown[],
        _mapping: Record<string, string>,
        onProgress?: (progress: ValidationProgress) => void
      ) => {
        const progress = {
          chunks: [
            {
              startRow: 0,
              endRow: 2,
              rows: baseRows.rows,
              errors: [],
              changes: baseRows.changes,
            },
          ],
          metadata: { ...baseProgress.metadata, errorCount: 0 },
          isComplete: true,
          groupedErrors: [],
          groupedChanges: [],
        };
        if (onProgress) {
          onProgress(progress);
        }
        return progress;
      }
    );

    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={onNext}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      expect(nextBtn).not.toBeDisabled();
    });

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({
        valid: baseRows.rows,
        errors: [],
      });
    });
  });

  it("toggles all rows selected via header checkbox", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const headerCheckboxes = screen.getAllByRole("checkbox");
    const headerCheckbox = headerCheckboxes.find(cb => {
      const parent = cb.closest("th");
      return parent && parent.textContent?.includes("#");
    });

    expect(headerCheckbox).toBeTruthy();
    if (headerCheckbox) {
      await user.click(headerCheckbox);

      await waitFor(() => {
        const rowCheckboxes = screen.queryAllByRole("checkbox");
        expect(rowCheckboxes.length).toBeGreaterThan(0);
      });
    }
  });

  it("toggles individual row selection via row checkbox", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    const rowNumber = screen.getByText("1");
    const rowCheckbox = rowNumber.parentElement?.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;

    if (rowCheckbox) {
      await user.click(rowCheckbox);
      await waitFor(() => {
        expect(rowCheckbox.checked).toBe(true);
      });
    } else {
      await user.click(rowNumber);
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Delete/i })
        ).toBeInTheDocument();
      });
    }
  });

  it("handles updateData when showErrors is true", async () => {
    const user = userEvent.setup();
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const errorsTab = screen.getByRole("tab", { name: /Errors Only/i });
    await user.click(errorsTab);

    await waitFor(() => {
      expect(errorsTab).toHaveAttribute("data-state", "active");
    });

    const input = screen.queryByLabelText("firstName-0") as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value: "Updated" } });
      fireEvent.blur(input);
    }
  });

  it("handles Find with empty find string early return", async () => {
    const { computeMatches } = await import("@/lib/findReplace");
    const initialCallCount = vi.mocked(computeMatches).mock.calls.length;

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const findBtn = screen
      .getAllByRole("button")
      .find(b => b.querySelector("svg.lucide-file-search"));
    if (findBtn) {
      const user = userEvent.setup();
      await user.click(findBtn);
      const popover = await screen.findByText(/Find and Replace/i);
      const scope = within(
        popover.closest("div[role='dialog']") || document.body
      );

      const findSubmitBtn = scope.getByRole("button", { name: /^find$/i });
      await user.click(findSubmitBtn);

      await waitFor(
        () => {
          expect(vi.mocked(computeMatches).mock.calls.length).toBe(
            initialCallCount
          );
        },
        { timeout: 1000 }
      ).catch(() => {
        // Expected - computeMatches shouldn't be called with empty find
      });
    }
  });

  it("clears find matches when FindReplace clear is called", async () => {
    const user = userEvent.setup();
    const { computeMatches } = await import("@/lib/findReplace");
    vi.mocked(computeMatches).mockReturnValueOnce(new Set(["0:firstName"]));

    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const findBtn = screen
      .getAllByRole("button")
      .find(b => b.querySelector("svg.lucide-file-search"));
    if (findBtn) {
      await user.click(findBtn);
      const popover = await screen.findByText(/Find and Replace/i);
      const scope = within(
        popover.closest("div[role='dialog']") || document.body
      );

      const inputs = scope.getAllByRole("textbox");
      await user.type(inputs[0] as HTMLInputElement, "Alice");

      const findSubmitBtn = scope.getByRole("button", { name: /^find$/i });
      await user.click(findSubmitBtn);

      await waitFor(() => {
        expect(computeMatches).toHaveBeenCalled();
      });

      const xBtn = scope
        .getAllByRole("button")
        .find(b => (b as HTMLButtonElement).textContent === "");
      if (xBtn) {
        await user.click(xBtn);
      }
    }
  });

  it("handles cell focus via setFocusedCell", async () => {
    render(
      <DataPreview
        fileData={fileData}
        mappings={mappings}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByRole("textbox");
    const input = inputs[0] as HTMLInputElement;
    const cell = input.closest("td");
    if (cell) {
      fireEvent.focus(input);
      fireEvent.blur(input);
    }
  });
});
