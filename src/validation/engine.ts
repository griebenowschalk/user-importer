// Determine the cleaning and pipeline strategy
import {
  getOptionSet,
  normalizeCase,
  trimValue,
  normalizeBasic,
} from "../lib/utils";
import type {
  CompiledConfig,
  CleaningRule,
  User,
  Complexity,
  CleaningChange,
  CleaningChangeType,
  ValidationError,
} from "../types";
import { rowHooks } from "./schema";

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
  const byTarget = new Map<keyof User, CleaningRule>();

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
        if (value == null) return null;
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
    byTarget.set(target, rule);
  }

  console.log(bySourceHeader);
  console.log(byTarget);

  // Calculate performance characteristics
  const hasUniquenessChecks = Array.from(bySourceHeader.values()).some(
    m => m.rule.unique
  );
  const hasComplexHooks = Array.from(bySourceHeader.values()).some(
    m => m.rule.columnHookId || !!hooks.onEntryInitHookId
  );
  let estimatedComplexity: Complexity = "low";
  if (hasUniquenessChecks || hasComplexHooks) {
    estimatedComplexity = "medium";
  }
  if (hasUniquenessChecks && hasComplexHooks) {
    estimatedComplexity = "high";
  }

  return {
    bySourceHeader,
    byTarget,
    rowHooks: hooks,
    hasUniquenessChecks,
    hasComplexHooks,
    estimatedComplexity,
  };
}

export function validationCore(
  rows: Record<string, unknown>[],
  config: CompiledConfig
) {
  const processedRows = new Array(rows.length);
  const errors: ValidationError[] = [];
  const changes: CleaningChange[] = [];

  const uniqueTracker = config.hasUniquenessChecks
    ? new Map<keyof User, Map<string, number>>()
    : null;

  if (uniqueTracker) {
    for (const entry of config.bySourceHeader.entries()) {
      if (entry[1].rule.unique) {
        uniqueTracker.set(entry[1].target, new Map());
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const sourceRow: Record<string, unknown> = rows[i];
    const destinationRow = { ...sourceRow };

    for (const [sourceHeader, meta] of config.bySourceHeader.entries()) {
      let cleanedValue: unknown = sourceRow[sourceHeader];
      let trackChanges: CleaningChangeType[] = [];
      const originalValue = cleanedValue;

      // Apply cleaning rules using the meta data
      if (meta.rule.trim) {
        cleanedValue = trimValue(cleanedValue as string, meta.rule.trim);
        trackChanges.push("trimmed");
      }

      if (meta.rule.case) {
        cleanedValue = normalizeCase(cleanedValue as string, meta.rule.case);
        trackChanges.push("caseChanged");
      }

      if (meta.rule.normalize) {
        cleanedValue = normalizeBasic(cleanedValue, meta.rule, meta.target);
        trackChanges.push("normalized");
      }

      if (cleanedValue !== originalValue) {
        changes.push({
          row: i,
          field: meta.target,
          originalValue,
          cleanedValue,
          changeType: trackChanges,
          description: `Cleaned value for ${meta.target}`,
        });
      }

      destinationRow[meta.target] = cleanedValue;
      destinationRow[sourceHeader] = cleanedValue;
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
        const uniqueKey: string = meta.rule.unique.ignoreCase
          ? (value as string).toLowerCase()
          : String(value);

        if (meta.rule.unique.ignoreNulls && value == null) {
          continue;
        }

        if (tracker?.has(uniqueKey)) {
          const firstRow = tracker.get(uniqueKey);
          errors.push({
            row: i,
            field: meta.target,
            message: `Duplicate value found in row ${firstRow}`,
            value,
          });
        } else {
          tracker?.set(uniqueKey, i);
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
