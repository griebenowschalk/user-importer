import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FileParseResult,
  User,
  ValidationProgress,
  CleaningResult,
  ValidationError,
  GroupedRowError,
  GroupedRowChange,
} from "@/types";
import { Typography } from "./ui/typography";
import { Button } from "./ui/button";
import { Container } from "./ui/container";
import { validateRowsOptimized } from "../lib/validationClient";
import { Progress } from "./ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./ui/tooltip";
import {
  getGroupedFieldChange,
  getGroupedFieldError,
  getGroupedFieldMessages,
} from "../lib/utils";

interface DataPreviewProps {
  fileData: FileParseResult;
  mappings: Record<string, keyof User>;
  onNext: (validatedData: { valid: any[]; errors: ValidationError[] }) => void;
  onBack: () => void;
}

export default function DataPreview({
  fileData,
  mappings,
  onNext,
  onBack,
}: DataPreviewProps) {
  const [showErrors, setShowErrors] = useState(false);
  const [groupedErrors, setGroupedErrors] = useState<GroupedRowError[] | null>(
    null
  );
  const [groupedChanges, setGroupedChanges] = useState<
    GroupedRowChange[] | null
  >(null);
  const [rows, setRows] = useState<CleaningResult | null>(null);
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const headers = fileData?.headers ?? [];

    const numberCol: ColumnDef<Record<string, unknown>> = {
      id: "_row",
      header: "#",
      cell: info => String(info.row.index + 1),
    };

    const dataCols = headers.map(sourceHeader => {
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

    return [numberCol, ...dataCols];
  }, [fileData?.headers, mappings]);

  // const [isEditing, setIsEditing] = useState(false);

  // keep local rows in sync when file changes
  useEffect(() => {
    if (!fileData || !mappings || Object.keys(mappings).length === 0) return;
    let cancelled = false;

    (async () => {
      const result = await validateRowsOptimized(
        fileData.rows,
        mappings,
        progress => {
          if (!cancelled) {
            setValidationProgress(progress);
          }
        }
      );
      if (!cancelled) {
        console.log(result);
        setRows({
          rows: result.chunks.flatMap(c => c.rows),
          errors: result.chunks.flatMap(c => c.errors),
          changes: result.chunks.flatMap(c => c.changes),
        });
        setGroupedErrors(result.groupedErrors ?? null);
        setGroupedChanges(result.groupedChanges ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileData, mappings]);

  const data = useMemo(
    () =>
      showErrors
        ? (groupedErrors ?? []).map(g => ({
            ...rows?.rows[g.row],
          }))
        : (rows?.rows ?? []),
    [rows, showErrors, groupedErrors]
  );

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
    if (
      header.includes("language") ||
      header.includes("country") ||
      header === "_row" ||
      header === "#"
    )
      return 80;
    if (
      header.toLowerCase().includes("name") ||
      header.toLowerCase().includes("id") ||
      header.toLowerCase().includes("date") ||
      header.toLowerCase().includes("phone")
    )
      return 120;
    return 150; // default width
  };

  const headerGroups = table.getHeaderGroups();

  return (
    <TooltipProvider>
      <Container className="data-preview">
        <Typography as="h2">Preview & Validate</Typography>
        <Typography as="p">Review your data before importing</Typography>
        <div className="mt-2 flex items-center gap-2">
          {/* <Button
          variant={isEditing ? "default" : "secondary"}
          onClick={() => setIsEditing(v => !v)}
        >
          {isEditing ? "Disable editing" : "Enable editing"}
        </Button> */}
          <Button
            variant={!showErrors ? "default" : "secondary"}
            onClick={() => setShowErrors(false)}
            disabled={!validationProgress?.isComplete}
          >
            All Rows
          </Button>
          <Button
            variant={showErrors ? "destructive" : "secondary"}
            onClick={() => setShowErrors(true)}
            disabled={!validationProgress?.isComplete}
          >
            Errors Only
          </Button>
        </div>
        {!validationProgress?.isComplete ? (
          <Progress
            value={
              validationProgress?.metadata.processedRows
                ? (validationProgress?.metadata.processedRows /
                    validationProgress?.metadata.totalRows) *
                  100
                : 0
            }
          />
        ) : (
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
                        className={
                          virtualRow.index % 2 ? "bg-gray-50" : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell, index) => {
                          const w = getColumnWidth(cell.column.id);
                          const isRowNumber = cell.column.id === "_row";
                          const targetFieldId =
                            (mappings as Record<string, string>)?.[
                              cell.column.id
                            ] ?? cell.column.id;
                          const isError = isRowNumber
                            ? undefined
                            : getGroupedFieldError(
                                groupedErrors,
                                targetFieldId,
                                showErrors,
                                row
                              );
                          const isChange =
                            !showErrors &&
                            (isRowNumber
                              ? undefined
                              : getGroupedFieldChange(
                                  groupedChanges,
                                  targetFieldId,
                                  row
                                ));
                          return (
                            <td
                              key={cell.id}
                              style={{
                                width: `${w}px`,
                                minWidth: `${w}px`,
                                maxWidth: `${w}px`,
                              }}
                              className={`px-3 py-2 border-b border-gray-300 text-left whitespace-nowrap overflow-hidden 
                              ${!isRowNumber && isChange && !isError ? "bg-blue-100" : ""} 
                              ${!isRowNumber && isError ? "bg-red-100" : ""} 
                              ${index !== columns.length - 1 ? "border-r" : ""}`}
                            >
                              {/* {isEditing ? (
                            <input
                              className="w-full truncate bg-transparent outline-none"
                              value={
                                (rows?.rows[row.index]?.[
                                  cell.column.id as string
                                ] as string | number | undefined) ?? ""
                              }
                              onChange={e => {
                                const value = e.target.value;
                                setRows(prev => {
                                  const next = [...(prev?.rows ?? [])];
                                  const current = {
                                    ...(next[row.index] ?? {}),
                                  };
                                  current[cell.column.id as string] = value;
                                  next[row.index] = current;

                                  return {
                                    ...prev,
                                    rows: next,
                                    errors: prev?.errors ?? [],
                                    changes: prev?.changes ?? [],
                                  };
                                });
                              }}
                            />
                          ) : (
                            
                          )} */}
                              {isRowNumber ? (
                                <span className="block w-full truncate align-middle">
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </span>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full truncate align-middle">
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  {isChange || isError ? (
                                    <TooltipContent className="whitespace-pre-line max-w-[300px]">
                                      {isError
                                        ? getGroupedFieldMessages(
                                            isError,
                                            targetFieldId
                                          )
                                        : isChange
                                          ? getGroupedFieldMessages(
                                              isChange,
                                              targetFieldId
                                            )
                                          : ""}
                                    </TooltipContent>
                                  ) : null}
                                </Tooltip>
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
        )}

        <div className="flex flex-row gap-2 justify-end">
          <Button onClick={onBack}>Back</Button>
          <Button
            disabled={
              !validationProgress?.isComplete || (rows?.errors?.length ?? 0) > 0
            }
            onClick={() =>
              onNext({ valid: rows?.rows ?? [], errors: rows?.errors ?? [] })
            }
          >
            Next
          </Button>
        </div>
      </Container>
    </TooltipProvider>
  );
}
