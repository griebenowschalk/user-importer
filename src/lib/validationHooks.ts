import { checkValidNumberCore, numberUpdate } from "./utils";
import type { ColumnHook, RowData, RowHook } from "../types";
import { allowedTLDs } from "../validation/schema";

const validateEmail = (
  row: RowData
): { row: RowData; error?: { field: string; message: string } } => {
  const domain = (row?.email as string)?.split("@")[1] ?? "";

  if (!allowedTLDs.some(tld => domain.includes(tld))) {
    return {
      row,
      error: {
        field: "email",
        message:
          "Invalid email domain. Only the following domains are allowed: " +
          allowedTLDs.join(", "),
      },
    };
  }

  return { row };
};

const copyEmptyNumber = (row: RowData) => {
  let rowUpdate = row;
  const updatedMobileNumber = rowUpdate?.mobileNumber;
  if (
    !row.workPhoneNumber &&
    checkValidNumberCore(
      (row.country as string) || "",
      (updatedMobileNumber as string) || (row.mobileNumber as string) || ""
    ).valid
  ) {
    rowUpdate = {
      ...rowUpdate,
      workPhoneNumber: String(updatedMobileNumber || row.mobileNumber),
    };
  }

  return { row: rowUpdate };
};

const validateAndUpdatePhoneNumber = (
  field: "workPhoneNumber" | "mobileNumber",
  row: RowData,
  rowUpdate: RowData,
  country: string,
  baseline: ReturnType<typeof checkValidNumberCore>,
  cleanUp?: boolean
) => {
  const phoneValue = row[field];
  if (!phoneValue) return { rowUpdate, error: null };

  const phoneCheck = checkValidNumberCore(country, phoneValue as string);
  const ccMismatch =
    (phoneValue as string).startsWith("+") &&
    !!phoneCheck.numberCallingCode &&
    !!baseline.callingCode &&
    phoneCheck.numberCallingCode !== baseline.callingCode;
  if (!phoneCheck.valid || ccMismatch) {
    const { newNumber, error } = numberUpdate(
      field,
      phoneValue as string,
      country,
      baseline.callingCode,
      true
    );

    let updatedRow = rowUpdate;
    if (cleanUp) {
      updatedRow = {
        ...updatedRow,
        [field]: newNumber,
      };
    }
    return { rowUpdate: updatedRow, error };
  }
  return { rowUpdate, error: null };
};

const validatePhoneNumber = (
  row: RowData,
  cleanUp?: boolean
): { row: RowData; errors?: { field: string; message: string }[] } => {
  let rowUpdate = row;
  const errors: { field: string; message: string }[] = [];
  const country = (row.country as string) || "";
  const baseline = checkValidNumberCore(
    country,
    (row.mobileNumber as string) || (row.workPhoneNumber as string) || ""
  );

  const resultWork = validateAndUpdatePhoneNumber(
    "workPhoneNumber",
    row,
    rowUpdate,
    country,
    baseline,
    cleanUp
  );
  rowUpdate = resultWork.rowUpdate;
  if (resultWork.error) {
    errors.push(resultWork.error);
  }

  const resultMobile = validateAndUpdatePhoneNumber(
    "mobileNumber",
    row,
    rowUpdate,
    country,
    baseline,
    cleanUp
  );
  rowUpdate = resultMobile.rowUpdate;
  if (resultMobile.error) {
    errors.push(resultMobile.error);
  }

  return { row: rowUpdate, errors };
};

const columnHookRegistry: Record<string, ColumnHook> = {};

const rowHookRegistry: Record<string, RowHook> = {
  onEntryInit: (row, cleanUp) => {
    let updatedRow = row;
    let errors: { field: string; message: string }[] = [];

    // Phone number validation
    if (updatedRow?.mobileNumber) {
      const { row: newRow, errors: phoneErrors } = validatePhoneNumber(
        updatedRow,
        cleanUp
      );

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
