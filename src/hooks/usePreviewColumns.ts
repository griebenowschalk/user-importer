import React, { useMemo } from "react";
import type { ColumnDef, CellContext } from "@tanstack/react-table";
import type { CleaningRule, GroupedRowError, User } from "@/types";
import EditableCell from "@/components/ui/editableCell";
import EditableSelect from "@/components/ui/editableSelect";

export interface UsePreviewColumnsParams {
  headers: string[];
  mappings: Record<string, keyof User> | null;
  showErrors: boolean;
  groupedErrors: GroupedRowError[] | null;
  rules: Record<keyof User, CleaningRule>;
  getColumnWidth: (id: string) => number;
}

export function usePreviewColumns(params: UsePreviewColumnsParams) {
  const { headers, mappings, rules } = params;

  const SelectComp = EditableSelect as unknown as React.ComponentType<{
    ctx: CellContext<Record<string, unknown>, unknown>;
    options: string[];
  }>;

  return useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const dataCols = (headers ?? []).map(sourceHeader => {
      const mapped = (mappings as Record<string, keyof User> | null)?.[
        sourceHeader
      ];
      const rule = mapped ? rules[mapped] : undefined;
      const hasOptions = !!rule?.options;
      const options: string[] = hasOptions
        ? Object.values(rule.options ?? {}).map(o => String(o))
        : [];
      return {
        id: sourceHeader,
        header: mapped ? mapped : sourceHeader,
        enableSorting: true,
        accessorKey: mapped ? mapped : sourceHeader,
        cell: hasOptions
          ? (ctx: CellContext<Record<string, unknown>, unknown>) =>
              React.createElement(SelectComp, { ctx, options })
          : (ctx: CellContext<Record<string, unknown>, unknown>) =>
              EditableCell(ctx),
      } as ColumnDef<Record<string, unknown>>;
    });

    return dataCols;
  }, [headers, mappings, rules, SelectComp]);
}
