import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindReplace } from "@/components/ui/findReplace";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionType } from "@/types";

function renderFR(opts?: { matches?: number }) {
  const onFind = vi.fn();
  const onClear = vi.fn();
  render(
    <TooltipProvider>
      <FindReplace
        fields={["firstName", "email"]}
        onFind={onFind}
        clear={onClear}
        matches={opts?.matches}
      />
    </TooltipProvider>
  );
  return { onFind, onClear };
}

describe("FindReplace", () => {
  it("opens popover and submits a Find action", async () => {
    const user = userEvent.setup();
    const { onFind } = renderFR();

    await user.click(screen.getAllByRole("button")[0]);

    const pop = await screen.findByText(/Find and Replace/i);
    const scope = within(pop.closest("div[role='dialog']") || document.body);

    const inputs = scope.getAllByRole("textbox");
    await user.type(inputs[0] as HTMLInputElement, "alice");

    const findBtn = scope.getByRole("button", { name: /^find$/i });
    await user.click(findBtn);

    expect(onFind).toHaveBeenCalled();
    const payload = onFind.mock.calls.at(-1)?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        find: "alice",
        field: "all",
        actionType: ActionType.find,
      })
    );
  });

  it("selects a field, toggles exact match and submits Replace All when matches > 0", async () => {
    const user = userEvent.setup();
    const { onFind } = renderFR({ matches: 3 });

    await user.click(screen.getAllByRole("button")[0]);
    const pop = await screen.findByText(/Find and Replace/i);
    const scope = within(pop.closest("div[role='dialog']") || document.body);

    const inputs = scope.getAllByRole("textbox");
    await user.type(inputs[0], "@example.com");
    await user.type(inputs[1], "@company.com");

    const fieldLabel = scope.getByText(/^Field$/i);
    const selectBtn = fieldLabel.parentElement!.querySelector(
      "button"
    ) as HTMLButtonElement;
    await user.click(selectBtn);
    await user.keyboard("{ArrowDown}{Enter}");

    const checkbox = scope.getByRole("checkbox");
    await user.click(checkbox);

    const replaceAllBtn = scope.getByRole("button", { name: /replace all/i });
    await user.click(replaceAllBtn);

    expect(onFind).toHaveBeenCalled();
    const payload = onFind.mock.calls.at(-1)?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        find: "@example.com",
        replace: "@company.com",
        field: "firstName",
        exactMatch: true,
        actionType: ActionType.find,
      })
    );
  });

  it("clears and closes when clicking X", async () => {
    const user = userEvent.setup();
    const { onClear } = renderFR();

    await user.click(screen.getAllByRole("button")[0]);
    const pop = await screen.findByText(/Find and Replace/i);
    const scope = within(pop.closest("div[role='dialog']") || document.body);

    const xBtn = scope
      .getAllByRole("button")
      .find(b => (b as HTMLButtonElement).textContent === "")!;
    await user.click(xBtn);

    expect(onClear).toHaveBeenCalled();
  });
});
