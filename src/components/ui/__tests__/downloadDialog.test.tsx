import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DownloadDialog from "@/components/ui/downloadDialog";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("DownloadDialog", () => {
  it("opens dialog and validates required fields", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();

    render(
      <TooltipProvider>
        <DownloadDialog onDownload={onDownload} />
      </TooltipProvider>
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    const saveBtn = await screen.findByRole("button", { name: /save/i });
    await user.click(saveBtn);

    expect(onDownload).not.toHaveBeenCalled();
  });

  it("selects format, submits, and closes dialog", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();

    render(
      <TooltipProvider>
        <DownloadDialog onDownload={onDownload} />
      </TooltipProvider>
    );

    await user.click(screen.getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");

    await user.type(
      within(dialog).getByPlaceholderText(/enter file name/i),
      "report"
    );

    await user.click(
      within(dialog)
        .getByText(/select a format/i)
        .closest("button")!
    );
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await user.click(within(dialog).getByTestId("save-button"));

    expect(onDownload).toHaveBeenCalledWith("report", "json");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
