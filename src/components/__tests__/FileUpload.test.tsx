import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileUpload from "@/components/FileUpload";

vi.mock("@/lib/templates", () => ({
  downloadExcelTemplate: vi.fn(),
  downloadCSVTemplate: vi.fn(),
}));

describe("FileUpload", () => {
  it("renders and triggers template downloads", async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();
    render(<FileUpload onFileUploaded={onFileUploaded} />);

    expect(screen.getByText(/Upload File/i)).toBeInTheDocument();

    const excelBtn = screen.getByRole("button", { name: /Excel Template/i });
    const csvBtn = screen.getByRole("button", { name: /CSV Template/i });
    await user.click(excelBtn);
    await user.click(csvBtn);

    const { downloadExcelTemplate, downloadCSVTemplate } = await import(
      "@/lib/templates"
    );
    expect(downloadExcelTemplate).toHaveBeenCalled();
    expect(downloadCSVTemplate).toHaveBeenCalled();
  });
});
