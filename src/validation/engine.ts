// Determine the cleaning and pipeline strategy
import {
  getOptionSet,
  normalizeCase,
  trimValue,
  normalizeBasic,
} from "../lib/utils";
import {
  CompiledConfig,
  CleaningRule,
  User,
  CleaningChange,
  CleaningChangeType,
  ValidationError,
} from "../types";
import { rowHooks } from "./schema";
import { changes as changeLocalisation } from "../localisation/changes";

export function compileConfig(
  mapping: Record<string, keyof User>,
  cleaningRules: Record<keyof User, CleaningRule>,
  hooks: typeof rowHooks
): CompiledConfig {
  const bySourceHeader = new Map<
    string,
    {
      target: keyof User;
      rule: CleaningRule;
      optionSet?: Set<string>;
      regex?: RegExp;
      validators: Array<(value: unknown) => string | null>;
    }
  >();

  // Pre-compile all validation functions for speed
  for (const [sourceHeader, target] of Object.entries(mapping)) {
    const rule = cleaningRules[target] ?? { trim: "both" };

    if (!rule) {
      throw new Error(`No cleaning rule found for target: ${target}`);
    }

    const validators: Array<(value: unknown) => string | null> = [];

    // Pre-compile option validation if needed
    if (rule.options) {
      const optionSet = getOptionSet(rule);

      validators.push(value => {
        if (!value) return null;
        const key =
          typeof value === "string"
            ? rule.case === "upper"
              ? value.toUpperCase()
              : rule.case === "lower"
                ? value.toLowerCase()
                : value
            : String(value);
        return optionSet.has(key) ? null : `Invalid option: ${value}`;
      });
    }

    // Pre-compile regex validation if needed
    if (rule.regex) {
      const regex = rule.regex;
      validators.push(value => {
        if (typeof value !== "string") return null;
        return regex.test(value) ? null : "Invalid format";
      });
    }

    // Add to compiled maps
    bySourceHeader.set(sourceHeader, {
      target,
      rule,
      optionSet: rule.options ? getOptionSet(rule) : undefined,
      regex: rule.regex,
      validators,
    });
  }

  // Calculate performance characteristics
  const hasUniquenessChecks = Array.from(bySourceHeader.values()).some(
    m => m.rule.unique
  );

  return {
    bySourceHeader,
    rowHooks: hooks,
    hasUniquenessChecks,
  };
}

export function validationCore(
  rows: Record<string, unknown>[],
  config: CompiledConfig,
  globalUniqueTracker?: Map<keyof User, Map<string, number>> | null,
  startRowOffset: number = 0
) {
  const processedRows = new Array(rows.length);
  const errors: ValidationError[] = [];
  const changes: CleaningChange[] = [];

  // Use global tracker if provided, otherwise create local one
  const uniqueTracker =
    globalUniqueTracker ||
    (config.hasUniquenessChecks
      ? new Map<keyof User, Map<string, number>>()
      : null);

  // Only initialize local tracker if we don't have a global one
  if (uniqueTracker && !globalUniqueTracker) {
    for (const entry of config.bySourceHeader.entries()) {
      if (entry[1].rule.unique) {
        uniqueTracker.set(entry[1].target, new Map());
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const sourceRow: Record<string, unknown> = rows[i];
    const destinationRow = { ...sourceRow };

    for (const [, meta] of config.bySourceHeader.entries()) {
      // Read from target field since rows are pre-transformed by worker
      let cleanedValue: unknown = sourceRow[meta.target];

      let trackChanges: CleaningChangeType[] = [];
      const originalValue = cleanedValue;

      // Apply cleaning rules using the meta data
      if (meta.rule.trim) {
        cleanedValue = trimValue(cleanedValue as string, meta.rule.trim);
        trackChanges.push(CleaningChangeType.trimmed);
      }

      if (meta.rule.case) {
        cleanedValue = normalizeCase(cleanedValue as string, meta.rule.case);
        trackChanges.push(CleaningChangeType.caseChanged);
      }

      if (meta.rule.normalize) {
        cleanedValue = normalizeBasic(cleanedValue, meta.rule, meta.target);
        trackChanges.push(CleaningChangeType.normalized);
      }

      if (cleanedValue !== originalValue) {
        changes.push({
          row: i,
          field: meta.target,
          originalValue,
          cleanedValue,
          changeType: trackChanges,
          description: `${trackChanges.map(change => changeLocalisation[change]).join("\n ")}`,
        });
      }

      destinationRow[meta.target] = cleanedValue;
    }

    for (const entry of config.bySourceHeader.entries()) {
      const meta = entry[1];
      const value = destinationRow[meta.target];

      // Use the pre-compiled validators
      for (const validator of meta.validators) {
        const error = validator(value);
        if (error) {
          errors.push({
            row: i,
            field: meta.target,
            message: error,
            value,
          });
        }
      }

      // Apply unique checks
      if (meta.rule.unique && uniqueTracker) {
        const tracker = uniqueTracker.get(meta.target);
        const uniqueKey: string =
          meta.rule.unique.ignoreCase && value
            ? (value as string).toLowerCase()
            : String(value);

        if (meta.rule.unique.ignoreNulls && value == null) {
          continue;
        }

        if (tracker?.has(uniqueKey)) {
          const firstRow = tracker.get(uniqueKey);
          const currentGlobalRow = i + startRowOffset;
          if (firstRow !== currentGlobalRow) {
            errors.push({
              row: i,
              field: meta.target,
              message: `Duplicate value found in row ${firstRow !== undefined ? firstRow + 1 : 0}`,
              value,
            });
          }
        } else {
          tracker?.set(uniqueKey, i + startRowOffset);
        }
      }
    }

    processedRows[i] = destinationRow;
  }

  return {
    rows: processedRows,
    errors,
    changes,
  };
}
