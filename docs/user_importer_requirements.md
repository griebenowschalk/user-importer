# User Importer --- Requirements & Technical Specification

_Last updated: 21 Aug 2025_

## 1) Summary

Replace Nuvo Importer with a lightweight, modular importer for Users
that supports CSV/XLS/XLSX/JSON, header-to-schema mapping, data cleaning
& validation, preview in a virtualized table, and batch submission to a
backend. Tech stack: **React 19**, **SheetJS**, **Yup**, **TanStack
Table** (+ React Virtual), optional **Web Worker** for parsing.

---

## 2) Goals & Non‑Goals

**Goals** - Upload CSV/XLS/XLSX/JSON up to ≥ **5,000 rows** (target ≥
25k with worker). - Let users **map file headers** to the system schema
(with suggested matches & alternates). - Apply **cleaning & validation**
(Yup) with per-field rules, uniqueness checks, and cross‑field rules. -
**Preview** cleaned/validated rows in a **virtualized table**;
filter/sort; fix inline errors. - Show clear **import results**
(imported/failed counts) and **downloadable error report**. - **i18n**
support for all UI strings; light/dark mode; accessible interactions. -
Minimal bundle footprint; modular design for maintenance and
testability.

**Non‑Goals** - Building a general-purpose ETL platform. - Server-side
Excel parsing (client handles parsing; server handles persistence &
duplicates). - Persistent drafts across sessions (v1 optional).

---

## 3) Primary User Stories

1.  As an admin, I upload a file and immediately see a **header
    mapping** step with best‑guess matches.
2.  As an admin, I can **clean & validate** the data automatically and
    see which rows/fields fail.
3.  As an admin, I can **preview** thousands of rows smoothly and
    edit/fix inline.
4.  As an admin, I **submit** valid rows to the backend and get a
    **success/failed** summary.
5.  As an admin, I can **download a CSV** of failed rows with error
    reasons.

---

## 4) Functional Requirements

### 4.1 Supported Inputs

- File types: **.csv, .xls, .xlsx, .json**
- Encoding: UTF‑8 (auto-detect BOM), delimiter auto-detect for CSV (,
  ; `\t)`{=tex}.
- First row may contain headers; if not, prompt to toggle "data has
  headers".

### 4.2 Schema (Target Users Model)

Fields (required unless noted): - `employeeId` (string; regex
`^[a-z0-9-#]+$`; **unique**) - `firstName` (string) - `lastName`
(string) - `email` (email; **unique**) - `startDate` (date
`YYYY-MM-DD`) - `department` (string) - `division` (string) - `position`
(string) - `region` (string) - `mobileNumber` (string, E.164 cleaned) -
`workPhoneNumber` (string, optional) - `gender` (enum from configured
list) - `country` (ISO‑3166‑1 alpha‑3 code; e.g., ZAF) - `city`
(string) - `dateOfBirth` (date `YYYY-MM-DD`) - `language` (enum from
configured list)

> Alternate header matches are configurable per field (e.g., `empId`,
> `empNumber`, `id`).

### 4.3 Header Mapping

- Auto‑suggest mapping by fuzzy match + alternativeMatches.
- Manual mapping UI (select target field for each source header; mark
  "Ignore" to skip).
- Persist mapping choice in localStorage (per `identifier` = `users`).

### 4.4 Cleaning & Validation (Yup)

- **Cleaning** prior to validation:
  - `employeeId`: lowercase + strip invalid chars.
  - `email`: trim + lowercase.
  - `startDate`/`dateOfBirth`: parse to `YYYY-MM-DD`.
  - Phone numbers: digits only; normalize to E.164 if country known.
- **Validation** via Yup schema; show field‑level errors.
- **Uniqueness** checks: in‑file duplicates (employeeId/email) +
  optional server pre‑check API.
- **Cross‑field** rules: e.g., `dateOfBirth` \< `startDate`.

### 4.5 Preview Table

- TanStack Table + React Virtual for rows.
- Columns reflect mapped schema; invalid cells show inline error state
  & tooltip.
- Bulk actions: hide invalid, show only invalid, export invalid.
- Sort & filter on valid data; debounce text filters.

### 4.6 Import Submission

- Submit **only valid rows** in **batches** (configurable `batchSize`
  default 500, concurrency 2--4).
- Display progress bar, per‑batch success/fail counts.
- On finish, show summary (imported, failed, skipped) and link to
  error CSV.

### 4.7 Error Handling

- File parse errors (type/encoding), schema errors, network errors,
  server validation errors.
- Retriable batches; exponential backoff.
- Graceful cancellation.

### 4.8 i18n & Theming

- All strings via `t('users:...')` keys; English provided; pluggable
  locales.
- Theming via CSS variables or Tailwind tokens; dark mode supported.

### 4.9 Accessibility (a11y)

- Keyboard navigable mapping & table.
- Proper roles/labels for inputs, errors.
- Color contrast ≥ AA; do not rely on color alone for error state.

### 4.10 Security & Privacy

- Files processed client‑side; no third‑party upload.
- Large files not persisted; memory cleared on unmount.
- HTTPS only; CSRF protection for POST; auth token via standard app
  mechanism.

---

## 5) Non‑Functional Requirements

- **Performance**: 5k rows render \< 200ms initial paint; smooth
  scroll; parse XLSX \< 3s for 5k rows (worker).
- **Scalability**: Support up to 25k rows with web worker & streaming
  CSV.
- **Bundle size**: Add ≤ \~120KB gzip (SheetJS core + table + yup;
  tree‑shaken).
- **Reliability**: Retry policy for batches; idempotent server
  endpoint via client‑side `clientImportId`.

---

## 6) Tech Stack & Packages

- **React 19**
- **SheetJS (xlsx)** for CSV/XLS/XLSX parsing
- **Yup** for validation
- **TanStack Table v8** + **@tanstack/react-virtual** for preview
- **date-fns** for date formatting
- **Papaparse** (optional) for streaming CSV (very large files)
- **Comlink** (optional) for web worker RPC convenience

**Install**

```bash
npm i xlsx yup @tanstack/react-table @tanstack/react-virtual date-fns
# optional for very large CSV & workers
npm i papaparse comlink
```
