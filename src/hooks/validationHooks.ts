import { checkValidNumber, numberUpdate } from "../lib/utils";
import type { ColumnHook, RowData, RowHook } from "../types";
import { allowedTLDs, PATTERNS } from "../validation/schema";

const validateEmail = (
  row: RowData
): { row: RowData; error?: { field: string; message: string } } => {
  const domain = (row?.email as string)?.split("@")[1] ?? "";

  if (!allowedTLDs.some(tld => domain.includes(tld))) {
    return { row, error: { field: "email", message: "Invalid email domain" } };
  }

  return { row };
};

const copyEmptyNumber = (row: RowData) => {
  let rowUpdate = row;
  const updatedMobileNumber = rowUpdate?.mobileNumber;
  if (
    !row.workPhoneNumber &&
    checkValidNumber(
      row.country as string,
      (updatedMobileNumber as string) || (row.mobileNumber as string)
    ).valid
  ) {
    rowUpdate = {
      ...rowUpdate,
      workPhoneNumber: String(updatedMobileNumber || row.mobileNumber),
    };
  }

  return { row: rowUpdate };
};

const validatePhoneNumber = (
  row: RowData
): { row: RowData; errors?: { field: string; message: string }[] } => {
  let rowUpdate = row;
  let errors = [];
  const { valid, callingCode } = checkValidNumber(
    row.country as string,
    row.workPhoneNumber as string
  );

  if (row.workPhoneNumber && !valid) {
    const { newNumber, error } = numberUpdate(
      "workPhoneNumber",
      row.workPhoneNumber as string,
      row.country as string,
      callingCode,
      true
    );

    rowUpdate = {
      ...rowUpdate,
      workPhoneNumber: newNumber,
    };
    if (error) {
      errors.push(error);
    }
  }

  if (row.mobileNumber && !valid) {
    const { newNumber, error } = numberUpdate(
      "mobileNumber",
      row.mobileNumber as string,
      row.country as string,
      callingCode,
      true
    );

    rowUpdate = {
      ...rowUpdate,
      mobileNumber: newNumber,
    };
    if (error) {
      errors.push(error);
    }
  }

  return { row: rowUpdate, errors };
};

const columnHookRegistry: Record<string, ColumnHook> = {
  employeeId: (value: unknown) => {
    if (typeof value !== "string" || !value) return value;

    return value
      .replace(/\s+/g, "")
      .toLowerCase()
      .split("")
      .filter(char => PATTERNS.EMPLOYEE_ID.test(char))
      .join("");
  },
};

const rowHookRegistry: Record<string, RowHook> = {
  onEntryInit: row => {
    let updatedRow = row;
    let errors: { field: string; message: string }[] = [];

    // Phone number validation
    if (updatedRow?.mobileNumber) {
      const { row: newRow, errors: phoneErrors } =
        validatePhoneNumber(updatedRow);
      updatedRow = newRow;
      if (phoneErrors) {
        errors.push(...phoneErrors);
      }
    }

    // Email validation
    if (updatedRow?.email) {
      const { row: newRow, error } = validateEmail(updatedRow);
      updatedRow = newRow;
      if (error) {
        errors.push(error);
      }
    }

    // Copy empty number
    if (updatedRow?.mobileNumber) {
      const { row: newRow } = copyEmptyNumber(updatedRow);
      updatedRow = newRow;
    }

    return [updatedRow, errors];
  },
};

export { columnHookRegistry, rowHookRegistry };
