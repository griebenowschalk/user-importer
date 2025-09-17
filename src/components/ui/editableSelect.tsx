import type { CellContext } from "@tanstack/react-table";
import { useEffect, useState } from "react";

function EditableSelect({
  ctx,
  options,
}: {
  ctx: CellContext<Record<string, unknown>, unknown>;
  options: string[];
}) {
  const { row, column, table } = ctx;
  const { index } = row;
  const { id } = column;
  const getValue = ctx.getValue as () => unknown;
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue ?? "");

  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v !== value) {
      setValue(v);
      const normalized = v === "" ? undefined : v;
      table.options.meta?.updateData(index, id, normalized);
    }
  };

  const stringValue = (value as string) ?? "";

  return (
    <select
      className="w-full h-full bg-transparent border-none outline-none"
      value={stringValue}
      // Mark the corresponding cell as focused for ring styling
      onFocus={() => table.options.meta?.setFocusedCell?.(index, id)}
      onBlur={() => table.options.meta?.setFocusedCell?.(-1, null)}
      onChange={onChange}
    >
      {/* Render a hidden placeholder only when value is empty, so blank shows without an empty option in the list */}
      {stringValue === "" && <option value="" hidden />}
      {stringValue !== "" && !options.find(opt => opt === stringValue) && (
        <option value={stringValue} hidden />
      )}
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export default EditableSelect;
