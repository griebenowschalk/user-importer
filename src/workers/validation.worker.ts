import { expose } from "comlink";
import {
  CleaningChange,
  CompiledConfig,
  RowData,
  CleaningChangeType,
  User,
  ValidationError,
  ValidationProgress,
  ValidationChunk,
} from "../types";
import { columnHookRegistry, rowHookRegistry } from "../hooks/validationHooks";
import {
  extractCleaningRules,
  rowHooks,
  userSchema,
} from "../validation/schema";
import { compileConfig, validationCore } from "../validation/engine";
import { groupChangesByRow, groupErrorsByRow } from "../lib/utils";
import { ObjectSchema } from "yup";
import { changes as stringChanges } from "../localisation/changes";

let PLAN: CompiledConfig | null = null;

const CHANGE_CAP_PER_CHUNK = 5000;

function pickChunkSize(rows: RowData[]) {
  if (!rows.length) return 1000;
  const cols = Object.keys(rows[0]).length;
  if (cols <= 8) return 3000;
  if (cols <= 16) return 2000;
  return 1000;
}

function debounceProgress<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): T {
  let last = 0;
  let timer: any = null;
  return ((...args: any[]) => {
    const now = performance.now();
    const run = () => {
      last = now;
      timer = null;
      fn(...args);
    };
    if (now - last > ms) run();
    else {
      clearTimeout(timer);
      timer = setTimeout(run, ms);
    }
  }) as T;
}

function applyHooks(rows: RowData[], plan: CompiledConfig, cleanUp?: boolean) {
  const changes: CleaningChange[] = [];
  const errors: ValidationError[] = [];

  for (const [index, row] of rows.entries()) {
    //Column hooks
    for (const [, meta] of plan.bySourceHeader.entries()) {
      if (!meta.rule.columnHookId) continue;
      const func = columnHookRegistry[meta.rule.columnHookId];
      if (!func) continue;

      const before = row[meta.target];
      const after = func(before, { field: meta.target, row });

      if (after !== before) {
        row[meta.target] = after;
        if (changes.length < CHANGE_CAP_PER_CHUNK) {
          changes.push({
            row: index,
            field: meta.target,
            originalValue: before,
            cleanedValue: after,
            changeType: [CleaningChangeType.customHook],
            description: `Column hook ${meta.rule.columnHookId} applied to ${meta.target}`,
          });
        }
      }

      console.log("row hooks", rows);
      //Row hooks
      if (plan.rowHooks?.onEntryInitHookId) {
        const rowFunc = rowHookRegistry[plan.rowHooks?.onEntryInitHookId];
        if (!rowFunc) continue;

        const before = row;
        const [after, error] = rowFunc(row, cleanUp);

        for (const e of error) {
          errors.push({
            row: index,
            field: e.field as keyof User,
            message: e.message,
            value: row,
          });
        }

        if (after !== before) {
          for (const value in after) {
            if (
              after[value] !== before[value] &&
              changes.length < CHANGE_CAP_PER_CHUNK
            ) {
              console.log("value", value);
              changes.push({
                row: index,
                field: value as keyof User,
                originalValue: before[value],
                cleanedValue: after[value],
                changeType: [CleaningChangeType.rowHook],
                description: `Row hook ${stringChanges.rowHook[value as keyof typeof stringChanges.rowHook]} applied`,
              });
            }
          }
          rows[index] = after;
        }
      }
    }
  }

  return { rows, changes, errors };
}

function batchYup(rows: RowData[], startRow: number) {
  const errors: ValidationError[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      userSchema.validateSync(row, { abortEarly: false, strict: false });
    } catch (error: any) {
      (error.inner ?? []).forEach((err: any) => {
        errors.push({
          row: index + startRow,
          field: err.path as keyof User,
          message: err.message,
          value: row,
        });
      });
    }
  }

  return errors;
}

async function validateInit(mapping: Record<string, keyof User>) {
  const rules = extractCleaningRules(userSchema as ObjectSchema<User>);
  PLAN = compileConfig(mapping, rules, rowHooks);
}

async function validateChunk(rows: RowData[], startRow: number) {
  if (!PLAN) throw new Error("Plan not initialized");

  // core ops (trim/case/normalize/regex/options/unique)
  const core = validationCore(rows, PLAN);

  // hooks (column/row)
  const withHooks = applyHooks(core.rows, PLAN, rows.length > 1);

  // yup
  const yupErrors = batchYup(withHooks.rows, startRow);

  // console.log("coreErrors", core.errors);
  // console.log("withHooks.errors", withHooks.errors);
  // console.log("yupErrors", yupErrors);

  // Offset core and hook indices to global row numbers
  const coreErrors = core.errors.map(e => ({ ...e, row: e.row + startRow }));
  const hookErrors = withHooks.errors.map(e => ({
    ...e,
    row: e.row + startRow,
  }));
  const coreChanges = core.changes.map(c => ({ ...c, row: c.row + startRow }));
  const hookChanges = withHooks.changes.map(c => ({
    ...c,
    row: c.row + startRow,
  }));

  return {
    startRow,
    endRow: startRow + rows.length,
    rows: withHooks.rows,
    errors: [...coreErrors, ...yupErrors, ...hookErrors],
    changes: [...hookChanges, ...coreChanges],
  };
}

async function validateAll(
  rows: RowData[],
  onProgress?: (progress: ValidationProgress) => void
): Promise<ValidationProgress> {
  const CHUNK = pickChunkSize(rows);
  const chunks: ValidationChunk[] = [];
  const debounced = onProgress ? debounceProgress(onProgress, 0) : undefined;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = await validateChunk(rows.slice(i, i + CHUNK), i);
    chunks.push(chunk);
    debounced?.({
      chunks,
      metadata: {
        totalRows: rows.length,
        processedRows: chunks.reduce(
          (acc, chunk) => acc + chunk.rows.length,
          0
        ),
        errorCount: chunks.reduce((acc, chunk) => acc + chunk.errors.length, 0),
        changeCount: chunks.reduce(
          (acc, chunk) => acc + chunk.changes.length,
          0
        ),
        estimatedTimeRemaining: 0,
      },
      isComplete: i + CHUNK >= rows.length,
    });

    // keep worker responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Collect all errors for grouping
  const allErrors = chunks.flatMap(chunk => chunk.errors);
  const groupedErrors = groupErrorsByRow(allErrors);
  const groupedChanges = groupChangesByRow(
    chunks.flatMap(chunk => chunk.changes)
  );

  const final = {
    chunks,
    metadata: {
      totalRows: rows.length,
      processedRows: chunks.reduce((acc, chunk) => acc + chunk.rows.length, 0),
      errorCount: chunks.reduce((acc, chunk) => acc + chunk.errors.length, 0),
      changeCount: chunks.reduce((acc, chunk) => acc + chunk.changes.length, 0),
      estimatedTimeRemaining: 0,
    },
    isComplete: true,
    groupedErrors,
    groupedChanges,
  };
  onProgress?.(final);

  return final;
}

expose({
  validateInit,
  validateAll,
  validateChunk,
});
