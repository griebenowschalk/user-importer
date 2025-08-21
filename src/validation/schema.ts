import * as yup from "yup";

export const userSchema = yup.object({
  employeeId: yup
    .string()
    .required("Employee ID is required")
    .matches(
      /^[a-z0-9-#]+$/,
      "Employee ID must contain only lowercase letters, numbers, hyphens, and hash symbols"
    )
    .min(1, "Employee ID cannot be empty"),

  firstName: yup
    .string()
    .required("First name is required")
    .min(1, "First name cannot be empty")
    .max(100, "First name is too long"),

  lastName: yup
    .string()
    .required("Last name is required")
    .min(1, "Last name cannot be empty")
    .max(100, "Last name is too long"),

  email: yup
    .string()
    .required("Email is required")
    .email("Invalid email format")
    .max(255, "Email is too long"),

  startDate: yup
    .string()
    .required("Start date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),

  department: yup
    .string()
    .required("Department is required")
    .min(1, "Department cannot be empty"),

  division: yup
    .string()
    .required("Division is required")
    .min(1, "Division cannot be empty"),

  position: yup
    .string()
    .required("Position is required")
    .min(1, "Position cannot be empty"),

  region: yup
    .string()
    .required("Region is required")
    .min(1, "Region cannot be empty"),

  mobileNumber: yup
    .string()
    .required("Mobile number is required")
    .min(1, "Mobile number cannot be empty"),

  workPhoneNumber: yup.string().optional(),

  gender: yup
    .string()
    .required("Gender is required")
    .min(1, "Gender cannot be empty"),

  country: yup
    .string()
    .required("Country is required")
    .length(3, "Country must be a 3-letter ISO code")
    .matches(/^[A-Z]{3}$/, "Country must be a valid 3-letter ISO code"),

  city: yup
    .string()
    .required("City is required")
    .min(1, "City cannot be empty"),

  dateOfBirth: yup
    .string()
    .required("Date of birth is required")
    .matches(
      /^\d{4}-\d{2}-\d{2}$/,
      "Date of birth must be in YYYY-MM-DD format"
    ),

  language: yup
    .string()
    .required("Language is required")
    .min(1, "Language cannot be empty"),
});

export type UserSchema = yup.InferType<typeof userSchema>;
