import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileParseResult, User, ValidationError } from "@/types";
import { Typography } from "./ui/typography";
import { Button } from "./ui/button";
import { Container } from "./ui/container";

interface DataPreviewProps {
  fileData: FileParseResult;
  mappings: Record<string, keyof User>;
  validatedData: {
    valid: Record<string, unknown>[];
    errors: ValidationError[];
  } | null;
  onValidatedDataChange: (data: {
    valid: Record<string, unknown>[];
    errors: ValidationError[];
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function DataPreview({
  fileData,
  mappings,
  validatedData: _validatedData,
  onValidatedDataChange: _onValidatedDataChange,
  onNext,
  onBack,
}: DataPreviewProps) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const headers = fileData?.headers ?? [];
    return headers.map(sourceHeader => {
      const mapped = mappings?.[sourceHeader];
      return {
        id: sourceHeader,
        header: mapped ? mapped : sourceHeader,
        accessorKey: sourceHeader,
        cell: info => {
          const value = info.getValue() as unknown;
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      } as ColumnDef<Record<string, unknown>>;
    });
  }, [fileData?.headers, mappings]);

  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>(
    fileData?.rows ?? []
  );

  // keep local rows in sync when file changes
  useEffect(() => {
    setRows(fileData?.rows ?? []);
  }, [fileData?.rows]);

  const data = useMemo(() => rows, [rows]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // fixed column widths based on content type
  const getColumnWidth = (header: string) => {
    if (header.includes("email")) return 200;
    if (header.includes("language") || header.includes("country")) return 80;
    if (
      header.includes("name") ||
      header.toLowerCase().includes("firstname") ||
      header.toLowerCase().includes("lastname") ||
      header.toLowerCase().includes("date") ||
      header.toLowerCase().includes("phone")
    )
      return 120;
    return 150; // default width
  };

  const headerGroups = table.getHeaderGroups();

  return (
    <Container className="data-preview">
      <Typography as="h2">Preview & Validate</Typography>
      <Typography as="p">Review your data before importing</Typography>
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant={isEditing ? "default" : "secondary"}
          onClick={() => setIsEditing(v => !v)}
        >
          {isEditing ? "Disable editing" : "Enable editing"}
        </Button>
      </div>
      <div className="mt-4 border rounded-md">
        <div ref={parentRef} className="overflow-auto h-[400px]">
          <table className="table-fixed w-max text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-gray-200 relative after:content-[''] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gray-500">
              {headerGroups.map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    return (
                      <th
                        key={header.id}
                        className={`px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap overflow-hidden ${
                          index !== headerGroup.headers.length - 1
                            ? "border-r border-gray-500"
                            : ""
                        }`}
                      >
                        <span className="block w-full truncate">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {/* top spacer */}
              {virtualItems.length > 0 ? (
                <tr style={{ height: virtualItems[0].start }}>
                  <td colSpan={columns.length} />
                </tr>
              ) : null}

              {virtualItems.map(virtualRow => {
                const row = table.getRowModel().rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className={virtualRow.index % 2 ? "bg-gray-50" : undefined}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const w = getColumnWidth(cell.column.id);
                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: `${w}px`,
                            minWidth: `${w}px`,
                            maxWidth: `${w}px`,
                          }}
                          className={`px-3 py-2 border-b border-gray-300 text-left whitespace-nowrap overflow-hidden ${
                            index !== columns.length - 1 ? "border-r" : ""
                          }`}
                        >
                          {isEditing ? (
                            <input
                              className="w-full truncate bg-transparent outline-none"
                              value={
                                (rows[row.index]?.[cell.column.id as string] as
                                  | string
                                  | number
                                  | undefined) ?? ""
                              }
                              onChange={e => {
                                const value = e.target.value;
                                setRows(prev => {
                                  const next = [...prev];
                                  const current = {
                                    ...(next[row.index] ?? {}),
                                  };
                                  current[cell.column.id as string] = value;
                                  next[row.index] = current;
                                  return next;
                                });
                              }}
                            />
                          ) : (
                            <span className="block w-full truncate align-middle">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* bottom spacer */}
              {virtualItems.length > 0 ? (
                <tr
                  style={{
                    height:
                      rowVirtualizer.getTotalSize() -
                      (virtualItems[virtualItems.length - 1].end ?? 0),
                  }}
                >
                  <td colSpan={columns.length} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-row gap-2 justify-end">
        <Button onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </Container>
  );
}
