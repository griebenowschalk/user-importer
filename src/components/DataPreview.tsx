import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowData,
  ColumnDef,
  type CellContext,
} from "@tanstack/react-table";
import { extractCleaningRules, userSchema } from "../validation/schema";
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
import {
  validateRowsOptimized,
  validateChunkOptimized,
} from "../lib/validationClient";
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
  groupErrorsByRow,
  groupChangesByRow,
} from "../lib/utils";
import { FileSearchIcon, DownloadIcon, InfoIcon } from "lucide-react";
import { fields } from "../localisation/fields";
import EditableSelect from "./ui/editableSelect";
import EditableCell from "./ui/editableCell";
import useSkipper from "../hooks/useSkipper";
import useFindError from "../hooks/useFindError";

interface DataPreviewProps {
  fileData: FileParseResult;
  mappings: Record<string, keyof User>;
  onNext: (validatedData: { valid: any[]; errors: ValidationError[] }) => void;
  onBack: () => void;
}

type HighlightCell = {
  rowIndex: number;
  colId: string;
};

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    // Reference generic to satisfy no-unused-vars
    __rowType__?: TData;
    setFocusedCell?: (rowIndex: number, columnId: string | null) => void;
  }
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
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();
  const [groupedChanges, setGroupedChanges] = useState<
    GroupedRowChange[] | null
  >(null);
  const [rows, setRows] = useState<CleaningResult | null>(null);
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  // Error navigation state/refs
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const [focusedCell, setFocusedCell] = useState<HighlightCell | null>(null);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const headers = fileData?.headers ?? [];
    const rules = extractCleaningRules(userSchema as any);

    const numberCol: ColumnDef<Record<string, unknown>> = {
      id: "_row",
      header: "#",
      cell: info => {
        const displayIndex = info.row.index;
        const originalRow = showErrors
          ? (groupedErrors?.[displayIndex]?.row ?? displayIndex)
          : displayIndex;
        return String(originalRow + 1);
      },
    };

    const dataCols = headers.map(sourceHeader => {
      const mapped = mappings?.[sourceHeader];
      const rule = mapped ? (rules as any)[mapped] : undefined;
      const hasOptions = !!rule?.options;
      const options: string[] = hasOptions
        ? Object.values(rule.options ?? {}).map(o => String(o))
        : [];
      return {
        id: sourceHeader,
        header: mapped ? mapped : sourceHeader,
        accessorKey: mapped ? mapped : sourceHeader, // Use target field for data access
        cell: hasOptions
          ? (ctx: CellContext<Record<string, unknown>, unknown>) => (
              <EditableSelect ctx={ctx} options={options} />
            )
          : EditableCell,
      } as ColumnDef<Record<string, unknown>>;
    });

    return [numberCol, ...dataCols];
  }, [fileData?.headers, mappings, showErrors, groupedErrors]);

  // keep local rows in sync when file changes
  useEffect(() => {
    if (!fileData || !mappings || Object.keys(mappings).length === 0) return;
    let cancelled = false;

    (async () => {
      const result = await validateRowsOptimized(
        fileData.rows, // Now contains raw data
        mappings,
        progress => {
          if (!cancelled) {
            setValidationProgress(progress);
          }
        }
      );
      if (!cancelled) {
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
    autoResetPageIndex,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        // Skip page index reset until after next rerender
        skipAutoResetPageIndex();
        setRows(old => {
          if (!old || !old.rows) return old;

          // Map visible rowIndex to actual global row when filtering errors
          const actualRowIndex = showErrors
            ? (groupedErrors?.[rowIndex]?.row ?? rowIndex)
            : rowIndex;

          const updatedRows = old.rows.map((row, index) => {
            if (index === actualRowIndex) {
              return {
                ...row,
                [columnId]: value,
              };
            }
            return row;
          });

          // Create updated raw row from file data
          const updatedRawRow = {
            ...fileData.rows[actualRowIndex],
            [columnId]: value,
          };

          // Optimistically update while we validate the single row
          (async () => {
            try {
              const chunk = await validateChunkOptimized(
                [updatedRawRow], // Use the updated raw row
                actualRowIndex,
                mappings // Pass current mappings
              );

              // Merge validation results for this single row
              setRows(current => {
                if (!current) return current;

                const mergedRows = current.rows.slice();
                mergedRows[actualRowIndex] = chunk.rows[0]!;

                // Replace errors and changes for this row index only
                const otherErrors = (current.errors ?? []).filter(
                  e => e.row !== actualRowIndex
                );
                const otherChanges = (current.changes ?? []).filter(
                  c => c.row !== actualRowIndex
                );

                const newErrors = otherErrors.concat(chunk.errors);
                const newChanges = otherChanges.concat(chunk.changes);

                // Update grouped derived state synchronously with rows/errors/changes
                setGroupedErrors(groupErrorsByRow(newErrors));
                setGroupedChanges(prev => [
                  ...(prev ?? []),
                  ...groupChangesByRow(newChanges),
                ]);

                return {
                  rows: mergedRows,
                  errors: newErrors,
                  changes: newChanges,
                };
              });
            } catch (err) {
              console.error("Single-row validation failed", err);
            }
          })();

          return {
            ...old,
            rows: updatedRows,
          };
        });
      },
      // Track which cell is currently focused for visual outline
      setFocusedCell: (rowIndex, columnId) => {
        if (rowIndex < 0 || !columnId) {
          setFocusedCell(null);
          return;
        }

        setFocusedCell({ rowIndex: rowIndex, colId: columnId });
      },
    },
  });

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20, // Increased from 10 to render more rows off-screen
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const {
    currentErrorIndex,
    setCurrentErrorIndex,
    focusError,
    errorTargetList,
  } = useFindError({
    groupedErrors: groupedErrors ?? [],
    columns,
    mappings,
    rowVirtualizer,
    showErrors,
    cellRefs: cellRefs.current,
    setFocusedCell: (focusedCell: {
      rowIndex: number;
      columnId: string | null;
    }) => {
      setFocusedCell({
        rowIndex: focusedCell.rowIndex,
        colId: focusedCell.columnId ?? "",
      });
    },
  });

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
        <div className="mt-2 flex flex-row justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!errorTargetList.length) return;
                const target = errorTargetList[currentErrorIndex]!;
                focusError(target);
                const next = (currentErrorIndex + 1) % errorTargetList.length;
                setCurrentErrorIndex(next);
              }}
              disabled={
                !validationProgress?.isComplete || !groupedErrors?.length
              }
            >
              Find Errors
            </Button>
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
              {`Errors Only (${rows?.errors?.length ?? 0})`}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {}}>
              <FileSearchIcon />
            </Button>
            <Button variant="outline" onClick={() => {}}>
              <DownloadIcon />
            </Button>
          </div>
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
            <div
              ref={parentRef}
              className="overflow-auto h-[400px] scroll-smooth"
            >
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
                            <span className="block w-full truncate flex items-center gap-2">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                              {header.column.columnDef.header !== "#" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <InfoIcon className="w-4 h-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="whitespace-pre-line max-w-[300px]">
                                    {
                                      fields[
                                        `${header.column.columnDef.header}_description` as keyof typeof fields
                                      ]
                                    }
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {/* top spacer with skeleton effect */}
                  {virtualItems.length > 0 && virtualItems[0].start > 0 ? (
                    <tr style={{ height: virtualItems[0].start }}>
                      <td
                        colSpan={columns.length}
                        className="bg-gradient-to-b from-gray-50 to-gray-100 animate-pulse"
                      >
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                          Loading rows...
                        </div>
                      </td>
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
                              ref={el => {
                                if (!el) return;
                                if (cell.column.id === "_row") return;
                                const key = `${row.index}:${cell.column.id}`;
                                cellRefs.current.set(key, el);
                              }}
                              style={{
                                width: `${w}px`,
                                minWidth: `${w}px`,
                                maxWidth: `${w}px`,
                              }}
                              className={`px-3 py-2 border-b border-gray-300 text-left whitespace-nowrap overflow-hidden 
                              ${!isRowNumber && isChange && !isError ? "bg-blue-100" : ""} 
                              ${!isRowNumber && isError ? "bg-red-100" : ""} 
                              ${index !== columns.length - 1 ? "border-r" : ""}
                              ${
                                focusedCell &&
                                focusedCell.rowIndex === row.index &&
                                focusedCell.colId === cell.column.id
                                  ? isError
                                    ? "outline outline-1 outline-red-500"
                                    : isChange
                                      ? "outline outline-1 outline-blue-500"
                                      : "outline outline-1 outline-black"
                                  : ""
                              }
                              `}
                            >
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
                                    {/* Wrapper span receives focus when inner input/select cannot */}
                                    <span
                                      className="block w-full truncate align-middle"
                                      tabIndex={-1}
                                      onFocus={() =>
                                        table.options.meta?.setFocusedCell?.(
                                          row.index,
                                          cell.column.id
                                        )
                                      }
                                      onBlur={() =>
                                        table.options.meta?.setFocusedCell?.(
                                          -1,
                                          null
                                        )
                                      }
                                    >
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

                  {/* bottom spacer with skeleton effect */}
                  {virtualItems.length > 0 ? (
                    <tr
                      style={{
                        height:
                          rowVirtualizer.getTotalSize() -
                          (virtualItems[virtualItems.length - 1].end ?? 0),
                      }}
                    >
                      <td
                        colSpan={columns.length}
                        className="bg-gradient-to-t from-gray-50 to-gray-100 animate-pulse"
                      >
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                          Loading rows...
                        </div>
                      </td>
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
