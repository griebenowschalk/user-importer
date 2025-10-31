import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CellContext } from "@tanstack/react-table";
import EditableSelect from "../editableSelect";

function Harness({
  ctx,
  options,
}: {
  ctx: CellContext<Record<string, unknown>, unknown>;
  options: string[];
}) {
  return <EditableSelect ctx={ctx} options={options} />;
}

describe("EditableSelect", () => {
  it("calls updateData on change", async () => {
    const user = userEvent.setup();
    const updateData = vi.fn();

    const ctx = {
      getValue: () => "female",
      row: { index: 0 } as any,
      column: { id: "gender" } as any,
      table: { options: { meta: { updateData } } } as any,
    } as unknown as CellContext<Record<string, unknown>, unknown>;

    render(<Harness ctx={ctx} options={["female", "male", "neither"]} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await user.selectOptions(select, "neither");

    expect(updateData).toHaveBeenCalledWith(0, "gender", "neither");
  });
});
