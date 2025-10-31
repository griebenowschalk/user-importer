import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportProgress from "@/components/ImportProgress";

describe("ImportProgress", () => {
  it("should render", () => {
    render(
      <ImportProgress data={{ valid: [], errors: [] }} onBack={() => {}} />
    );
    expect(screen.getByText("Data Clean & Validated")).toBeInTheDocument();
  });

  it("should call onBack when Back button is clicked", () => {
    const onBack = vi.fn();
    render(<ImportProgress data={{ valid: [], errors: [] }} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("should display valid data", () => {
    const validData = [{ firstName: "John" }];
    render(
      <ImportProgress
        data={{ valid: validData, errors: [] }}
        onBack={() => {}}
      />
    );
    const pre = screen.getByText(/firstName.*John/).closest("pre");
    expect(pre?.textContent).toContain('"firstName": "John"');
  });

  it("should remove email property from rows in useEffect", async () => {
    const row1 = { firstName: "John", email: "" };
    const row2 = { firstName: "Jane", email: undefined };
    const row3 = { firstName: "Bob", email: "bob@example.com" };
    const data = { valid: [row1, row2, row3], errors: [] };

    render(<ImportProgress data={data} onBack={() => {}} />);

    await waitFor(() => {
      expect(row1).not.toHaveProperty("email");
      expect(row2).not.toHaveProperty("email");
      expect(row3).toHaveProperty("email");
      expect(row3.email).toBe("bob@example.com");
    });

    expect("email" in row1).toBe(false);
    expect("email" in row2).toBe(false);
    expect("email" in row3).toBe(true);
  });
});
