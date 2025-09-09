import * as yup from "yup";
import type { CleaningRule, User } from "../types";
import { customList } from "country-codes-list";
import { toAlpha3 } from "i18n-iso-countries";

export const PATTERNS = {
  EMPLOYEE_ID: /^[a-z0-9-#]+$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  ISO_COUNTRY: /^[A-Z]{3}$/,
} as const;

export const allowedTLDs = [".com", ".co.za", ".gov", ".edu", ".org", ".net"];

const OPTIONS = {
  gender: ["male", "female", "neither"],
  language: ["en"],
} as const;

export const userSchema = yup.object({
  employeeId: yup
    .string()
    .required("Employee ID is required")
    .matches(
      PATTERNS.EMPLOYEE_ID,
      "Employee ID must contain only lowercase letters, numbers, hyphens, and hash symbols"
    )
    .min(1, "Employee ID cannot be empty")
    .meta({
      type: "string",
      trim: "both",
      case: "lower",
      regex: PATTERNS.EMPLOYEE_ID,
      columnHookId: "employeeId",
      unique: {
        ignoreCase: true,
      },
    }),

  firstName: yup
    .string()
    .required("First name is required")
    .min(1, "First name cannot be empty")
    .max(50, "First name is too long")
    .meta({
      type: "string",
      trim: "both",
    }),

  lastName: yup
    .string()
    .required("Last name is required")
    .min(1, "Last name cannot be empty")
    .max(50, "Last name is too long")
    .meta({
      type: "string",
      trim: "both",
    }),

  email: yup
    .string()
    .optional()
    .nullable()
    .email("Invalid email format")
    .max(80, "Email is too long")
    .meta({
      type: "email",
      trim: "both",
      case: "lower",
      unique: {
        ignoreCase: true,
        ignoreNulls: true,
      },
    }),

  startDate: yup
    .string()
    .required("Start date is required")
    .matches(PATTERNS.ISO_DATE, "Start date must be in YYYY-MM-DD format")
    .meta({
      type: "date",
      trim: "both",
      regex: PATTERNS.ISO_DATE,
      columnHookId: "dateFormatting",
      normalize: {
        toISODate: true,
      },
    }),

  department: yup
    .string()
    .required("Department is required")
    .min(1, "Department cannot be empty")
    .meta({
      type: "string",
      trim: "both",
    }),

  division: yup
    .string()
    .required("Division is required")
    .min(1, "Division cannot be empty")
    .meta({
      type: "string",
      trim: "both",
    }),

  position: yup
    .string()
    .required("Position is required")
    .min(1, "Position cannot be empty")
    .meta({
      type: "string",
      trim: "both",
    }),

  region: yup
    .string()
    .required("Region is required")
    .min(1, "Region cannot be empty")
    .meta({
      type: "string",
      trim: "both",
    }),

  mobileNumber: yup
    .string()
    .required("Mobile number is required")
    .min(1, "Mobile number cannot be empty")
    .meta({
      type: "phone",
      trim: "both",
      normalize: {
        phoneDigitsOnly: true,
      },
    }),

  workPhoneNumber: yup
    .string()
    .optional()
    .nullable()
    .meta({
      type: "phone",
      trim: "both",
      normalize: {
        phoneDigitsOnly: true,
      },
    }),

  gender: yup
    .string()
    .required("Gender is required")
    .min(1, "Gender cannot be empty")
    .meta({
      type: "category",
      trim: "both",
      options: OPTIONS.gender,
    }),

  country: yup
    .string()
    .required("Country is required")
    .length(3, "Country must be a 3-letter ISO code")
    .matches(PATTERNS.ISO_COUNTRY, "Country must be a valid 3-letter ISO code")
    .meta({
      type: "country",
      trim: "both",
      options: Object.keys(customList("countryCode")).map(c => toAlpha3(c)),
      regex: PATTERNS.ISO_COUNTRY,
      normalize: {
        toISO3: true,
      },
    }),

  city: yup
    .string()
    .required("City is required")
    .min(1, "City cannot be empty")
    .meta({
      type: "string",
      trim: "both",
    }),

  dateOfBirth: yup
    .string()
    .required("Date of birth is required")
    .matches(PATTERNS.ISO_DATE, "Date of birth must be in YYYY-MM-DD format")
    .meta({
      type: "date",
      trim: "both",
      regex: PATTERNS.ISO_DATE,
      columnHookId: "dateFormatting",
      normalize: {
        toISODate: true,
      },
    }),

  language: yup
    .string()
    .required("Language is required")
    .min(1, "Language cannot be empty")
    .meta({
      type: "category",
      options: OPTIONS.language,
      trim: "both",
    }),
});

export type UserSchema = yup.InferType<typeof userSchema>;

export function extractCleaningRules(
  schema: yup.ObjectSchema<User>
): Record<keyof User, CleaningRule> {
  const rules: Record<keyof User, CleaningRule> = {} as Record<
    keyof User,
    CleaningRule
  >;

  Object.entries(schema.fields).forEach(([key, field]) => {
    const meta = (field as yup.AnySchema).meta() as CleaningRule;
    if (meta) {
      rules[key as keyof User] = meta;
    }
  });

  return rules;
}

export const rowHooks = {
  onEntryInitHookId: "onEntryInit",
  onEntryChangeHookId: "onEntryChange",
} as const;
