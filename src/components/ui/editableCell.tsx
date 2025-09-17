import type { CellContext } from "@tanstack/react-table";
import { useEffect, useState } from "react";

function EditableCell(ctx: CellContext<Record<string, unknown>, unknown>) {
  const { getValue, row, column, table } = ctx;
  const { index } = row;
  const { id } = column;
  const initialValue = getValue();
  const [value, setValue] = useState<string>(
    () => ((initialValue as string | number | null | undefined) ?? "") as string
  );

  const onBlur = () => {
    if (value !== initialValue) {
      table.options.meta?.updateData(index, id, value);
    }
  };

  // Keep the current error index within bounds of the latest errorTargetList.
  useEffect(() => {
    setValue((((initialValue as any) ?? "") as string) ?? "");
  }, [initialValue]);

  return (
    <input
      className="w-full h-full bg-transparent border-none outline-none"
      value={(value as string) ?? ""}
      onChange={e => {
        if (e.target.value !== value) {
          setValue(e.target.value ?? "");
        }
      }}
      // Mark the corresponding cell as focused for ring styling
      onFocus={() => table.options.meta?.setFocusedCell?.(index, id)}
      onBlur={() => {
        onBlur();
        table.options.meta?.setFocusedCell?.(-1, null);
      }}
    />
  );
}

export default EditableCell;
