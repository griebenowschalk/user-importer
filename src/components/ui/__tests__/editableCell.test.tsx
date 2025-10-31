import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CellContext } from "@tanstack/react-table";
import EditableCell from "../editableCell";

function Harness({
  ctx,
}: {
  ctx: CellContext<Record<string, unknown>, unknown>;
}) {
  return EditableCell(ctx);
}

describe("EditableCell", () => {
  it("calls updateData on blur when value changes", async () => {
    const user = userEvent.setup();
    const updateData = vi.fn();

    const ctx = {
      getValue: () => "Alice",
      row: { index: 0 } as any,
      column: { id: "firstName" } as any,
      table: { options: { meta: { updateData } } } as any,
    } as unknown as CellContext<Record<string, unknown>, unknown>;

    render(<Harness ctx={ctx} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.click(input);
    await user.type(input, "Z");
    input.blur();

    expect(updateData).toHaveBeenCalledWith(0, "firstName", "AliceZ");
  });
});
