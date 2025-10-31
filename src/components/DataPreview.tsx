import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowData,
  ColumnDef,
  RowSelectionState,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import { extractCleaningRules, userSchema } from "../validation/schema";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CleaningResult,
  GroupedRowError,
  GroupedRowChange,
  DataPreviewProps,
  HighlightCell,
  ActionType,
  User,
  CleaningRule,
} from "@/types";
import { Typography } from "./ui/typography";
import { Button } from "./ui/button";
import { Container } from "./ui/container";
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
  getColumnWidth,
  toRegex,
} from "../lib/utils";
import {
  InfoIcon,
  DeleteIcon,
  CopyIcon,
  ArrowUpDownIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  UndoIcon,
  RedoIcon,
} from "lucide-react";
import { fields } from "../localisation/fields";
import useSkipper from "../hooks/useSkipper";
import useFindError from "../hooks/useFindError";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import DownloadDialog from "./ui/downloadDialog";
import { downloadFile } from "../lib/workerClient";
import { FindReplace } from "./ui/findReplace";
import { useTableHistory } from "../hooks/useTableHistory";
import { useValidation } from "@/hooks/useValidation";
import { usePreviewColumns } from "@/hooks/usePreviewColumns";
import { createPreviewController } from "@/lib/previewController";
import { bulkFindReplace, computeMatches } from "@/lib/findReplace";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    deleteRows: (rowIndices: number[]) => void;
    duplicateRow: (rowIndex: number) => void;
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
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();
  const [focusedCell, setFocusedCell] = useState<HighlightCell | null>(null);
  const [findMatches, setFindMatches] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  const {
    validationProgress,
    rows,
    setRows,
    groupedErrors,
    setGroupedErrors,
    groupedChanges,
    setGroupedChanges,
  } = useValidation(fileData, mappings);

  const rules = useMemo(() => extractCleaningRules(userSchema as any), []);

  const dataCols = usePreviewColumns({
    headers: fileData?.headers ?? [],
    mappings,
    showErrors,
    groupedErrors,
    rules: rules as Record<keyof User, CleaningRule>,
    getColumnWidth,
  });

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const numberCol: ColumnDef<Record<string, unknown>> = {
      id: "_row",
      enableSorting: false,
      header: ({ table }) => (
        <div className="flex w-fit items-center gap-2 justify-center pl-1">
          <Typography as="span">#</Typography>
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={() => table.toggleAllRowsSelected()}
          />
        </div>
      ),
      cell: ({ row }) => {
        const displayIndex = row.index;
        const originalRow = showErrors
          ? (groupedErrors?.[displayIndex]?.row ?? displayIndex)
          : displayIndex;
        return (
          <div
            onClick={() => row.toggleSelected()}
            className="flex items-center gap-2 justify-center group cursor-pointer"
          >
            {row.getIsSelected() ? (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={() => row.toggleSelected()}
              />
            ) : (
              <>
                <span className="group-hover:hidden">{originalRow + 1}</span>
                <span className="hidden group-hover:inline-flex">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => row.toggleSelected()}
                  />
                </span>
              </>
            )}
          </div>
        );
      },
    };

    return [numberCol, ...dataCols];
  }, [dataCols, showErrors, groupedErrors]);

  const { undo, redo, canUndo, canRedo, getTableState, pushHistory } =
    useTableHistory(
      rows,
      groupedErrors,
      groupedChanges,
      (next: CleaningResult) => setRows(next),
      (ge: GroupedRowError[] | null) => setGroupedErrors(ge),
      (gc: GroupedRowChange[] | null) => setGroupedChanges(gc)
    );

  const controller = useMemo(
    () =>
      createPreviewController({
        mappings: (mappings as Record<string, keyof User>) ?? {},
        getTableState: () => ({
          rows: rows?.rows ?? [],
          errors: rows?.errors ?? [],
          changes: rows?.changes ?? [],
          groupedErrors: groupedErrors ?? [],
          groupedChanges: groupedChanges ?? [],
        }),
        setRows: (state: any) =>
          setRows({
            rows: state.rows,
            errors: state.errors,
            changes: state.changes,
          }),
        setGroupedErrors,
        setGroupedChanges,
        pushHistory,
        fileRows: fileData?.rows ?? [],
      }),
    [
      mappings,
      rows,
      groupedErrors,
      groupedChanges,
      setRows,
      setGroupedErrors,
      setGroupedChanges,
      pushHistory,
      fileData?.rows,
    ]
  );

  const data = useMemo(
    () =>
      showErrors
        ? (groupedErrors ?? []).map(g => ({ ...rows?.rows[g.row] }))
        : (rows?.rows ?? []),
    [rows, showErrors, groupedErrors]
  );

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
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
    setFocusedCell: ({ rowIndex, columnId }) =>
      setFocusedCell({ rowIndex, colId: columnId ?? "" }),
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    autoResetPageIndex,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableMultiRowSelection: true,
    onRowSelectionChange: setSelectedRows,
    state: { rowSelection: selectedRows, sorting },
    meta: {
      updateData: (rowIndex, columnId, value) => {
        skipAutoResetPageIndex();
        const actualRowIndex = showErrors
          ? (groupedErrors?.[rowIndex]?.row ?? rowIndex)
          : rowIndex;
        const baseRow = controller.getBaseRow(actualRowIndex);
        const targetField = ((mappings as Record<string, string>)?.[columnId] ??
          columnId) as string;
        const updatedRawRow = { ...baseRow, [targetField]: value } as Record<
          string,
          unknown
        >;
        controller.validateAndUpdateRow(
          updatedRawRow,
          actualRowIndex,
          "replace",
          `Edit row ${actualRowIndex + 1} in column ${columnId}`
        );
      },
      deleteRows: rowIndices => {
        skipAutoResetPageIndex();
        controller.deleteRows(rowIndices, showErrors, groupedErrors ?? []);
        setSelectedRows({});
      },
      duplicateRow: rowIndex => {
        skipAutoResetPageIndex();
        controller.duplicateRow(rowIndex, showErrors, groupedErrors ?? []);
        setSelectedRows({});
      },
      setFocusedCell: (rowIndex, columnId) => {
        if (rowIndex < 0 || !columnId) {
          setFocusedCell(null);
          return;
        }
        setFocusedCell({ rowIndex, colId: columnId });
      },
    },
  });

  const headerGroups = table.getHeaderGroups();

  const handleBulkFindReplace = async (params: {
    find: string;
    field: string;
    exactMatch?: boolean;
    replace: string;
  }) => {
    const result = await bulkFindReplace({
      data,
      rows,
      fileDataRows: fileData?.rows ?? [],
      mappings: mappings as Record<string, keyof User>,
      find: params.find,
      field: params.field,
      exactMatch: params.exactMatch,
      replace: params.replace,
      validateChunk: async (r, s, m) =>
        (await import("@/lib/validationClient")).validateChunkOptimized(
          r,
          s,
          m
        ),
      getTableState: () => ({
        rows: rows?.rows ?? [],
        errors: rows?.errors ?? [],
        changes: rows?.changes ?? [],
      }),
    });
    if (!result) return;

    const prevState = getTableState()!;
    setRows({
      rows: result.nextRows,
      errors: result.nextErrors,
      changes: result.nextChanges,
    });
    setGroupedErrors(result.nextGroupedErrors);
    setGroupedChanges(result.nextGroupedChanges);
    pushHistory(
      `Replace (${result.affectedSize} row${result.affectedSize === 1 ? "" : "s"})`,
      prevState,
      {
        rows: result.nextRows,
        errors: result.nextErrors,
        changes: result.nextChanges,
        groupedErrors: result.nextGroupedErrors,
        groupedChanges: result.nextGroupedChanges,
      }
    );
  };

  const handleFind = async (params: {
    find: string;
    field: string;
    exactMatch?: boolean;
    replace?: string;
    actionType: ActionType;
  }) => {
    const { find, field, replace, exactMatch, actionType } = params;
    if (!find?.length || !field?.length) return;

    if (replace && replace.length > 0 && actionType === ActionType.replaceAll) {
      await handleBulkFindReplace({ find, field, exactMatch, replace });
      setFindMatches(new Set<string>());
      return;
    }
    const regex = toRegex(find, exactMatch);
    setFindMatches(computeMatches(data, field, regex));
  };

  return (
    <TooltipProvider>
      <Container className="data-preview">
        <Typography as="h2">Preview & Validate</Typography>
        <Typography as="p">Review your data before importing</Typography>
        <div className="mt-2 flex flex-row justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
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
            <Tabs
              value={showErrors ? "errors" : "all"}
              onValueChange={value => setShowErrors(value === "errors")}
            >
              <TabsList>
                <TabsTrigger
                  value="all"
                  disabled={!validationProgress?.isComplete}
                >
                  All Rows
                </TabsTrigger>
                <TabsTrigger
                  value="errors"
                  disabled={!validationProgress?.isComplete}
                >
                  {`Errors Only (${rows?.errors?.length ?? 0})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {Object.keys(selectedRows).length > 0 && (
              <Button
                variant="destructive"
                onClick={() => {
                  const selected = Object.keys(selectedRows).map(Number);
                  table.options.meta?.deleteRows?.(selected);
                }}
              >
                <DeleteIcon />
                <Typography as="span">Delete</Typography>
              </Button>
            )}
            {Object.keys(selectedRows).length === 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  const selected = Object.keys(selectedRows).map(Number)[0];
                  table.options.meta?.duplicateRow?.(selected);
                }}
              >
                <CopyIcon />
                <Typography as="span">Duplicate</Typography>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={!canUndo}
                  variant="outline"
                  onClick={() => undo()}
                >
                  <UndoIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line max-w-[300px]">
                {"Undo last action"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={!canRedo}
                  variant="outline"
                  onClick={() => redo()}
                >
                  <RedoIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line max-w-[300px]">
                {"Redo last action"}
              </TooltipContent>
            </Tooltip>
            <FindReplace
              fields={rows?.rows[0] ? Object.keys(rows.rows[0]) : []}
              onFind={handleFind}
              clear={() => setFindMatches(new Set())}
              matches={findMatches.size > 0 ? findMatches.size : undefined}
            />
            <DownloadDialog
              onDownload={(fileName: string, format: string) => {
                downloadFile(rows?.rows ?? [], fileName, format);
              }}
            />
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
              className="overflow-auto h_[400px] scroll-smooth"
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
                            {(() => {
                              const canSort = header.column.getCanSort();
                              const common =
                                "block w-full truncate flex justify-between items-center gap-2";
                              const content = (
                                <>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                  <span className="flex items-center gap-2">
                                    {canSort && (
                                      <>
                                        {header.column.getIsSorted() ===
                                        "asc" ? (
                                          <ArrowUpIcon className="w-4 h-4" />
                                        ) : header.column.getIsSorted() ===
                                          "desc" ? (
                                          <ArrowDownIcon className="w-4 h-4" />
                                        ) : (
                                          <ArrowUpDownIcon className="w-4 h-4" />
                                        )}
                                      </>
                                    )}
                                    {header.column.columnDef.id !== "_row" && (
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
                                </>
                              );
                              return canSort ? (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className={common}
                                >
                                  {content}
                                </button>
                              ) : (
                                <div className={common}>{content}</div>
                              );
                            })()}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
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
                          const targetFieldId = ((
                            mappings as Record<string, keyof User>
                          )?.[cell.column.id] ?? cell.column.id) as string;
                          const isFindMatch =
                            !isRowNumber &&
                            findMatches.has(`${row.index}:${targetFieldId}`);
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
                              ${!isRowNumber && isFindMatch ? "bg-yellow-100" : ""} 
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
