# User Importer

A lightweight, modular importer for Users that supports CSV/XLS/XLSX/JSON, header-to-schema mapping, data cleaning & validation, preview in a virtualized table, and scalable handling of large files (25k+ rows).

[Live Demo – Click to open](https://user-importer.netlify.app/)

## Tech Stack

- **React 19** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **SheetJS (xlsx)** - Excel file parsing
- **PapaParse** - CSV parsing with streaming support
- **Yup** - Data validation schemas
- **TanStack Table v8** - Virtualized data tables
- **React Virtual** - Efficient rendering of large datasets
- **Comlink** - Web Worker communication
- **Vite** - Fast build tool and dev server

## Features

- **Multi-format support**: CSV, XLS, XLSX, and JSON files
- **Header mapping**: Intelligent mapping with fuzzy matching
- **Data validation**: Yup-based validation with custom rules
- **Large file handling**: Web Worker support for files up to 25k+ rows
- **Virtualized preview**: Smooth scrolling through large datasets
- **Batch processing**: Configurable batch sizes for import operations
- **Error handling**: Comprehensive error reporting and recovery

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd user-importer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:4000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint (with warnings allowed)
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Development

### Code Quality Tools

The project uses several tools to maintain code quality:

- **ESLint** - Code linting with TypeScript and React rules
- **Prettier** - Code formatting with consistent style
- **Husky** - Git hooks for pre-commit validation
- **lint-staged** - Run linters only on staged files

### Pre-commit Hooks

Before each commit, the following checks run automatically:

- ESLint validation
- Prettier formatting
- TypeScript type checking

### Editor Setup

For the best development experience, install these VSCode extensions:

- ESLint
- Prettier - Code formatter
- TypeScript Importer

The workspace includes VSCode settings for:

- Auto-formatting on save
- ESLint auto-fix on save
- Consistent formatting rules

## Project Structure

```
src/
├── components/          # React components
│   ├── ui               # Generic ui components
│   ├── FileUpload.tsx  # File upload interface
│   ├── HeaderMapping.tsx # Header mapping UI
│   ├── DataPreview.tsx # Data preview table
│   └── ImportProgress.tsx # Import progress tracking
├── state/              # Custom React XState
│   └── importer.ts     # Main state management
├── types/              # TypeScript type definitions
│   └── index.ts        # Core interfaces
├── lib/                # Shared utilities (shadcn utils, workers, helpers)
│   └── workerClient.ts # Setup worker for file parsing
├── validation/         # Validation schemas
│   └── schema.ts       # Yup validation schemas
├── workers/            # Web Workers
│   └── parser.worker.ts # File parsing worker
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Usage

1. **Upload File**: Drag & drop or select a CSV, Excel, or JSON file
2. **Map Headers**: Map your file columns to the user schema fields
3. **Preview & Validate**: Review data and fix validation errors
4. **Import**: Submit valid data to your backend system

## Configuration

### Supported File Types

- **CSV**: UTF-8 encoded, comma/semicolon/tab delimited
- **Excel**: .xls and .xlsx formats
- **JSON**: Array of objects with consistent structure

### User Schema Fields

- `employeeId` (required, unique)
- `firstName` (required)
- `lastName` (required)
- `email` (required, unique, email format)
- `startDate` (required, YYYY-MM-DD format)
- `department` (required)
- `division` (required)
- `position` (required)
- `region` (required)
- `mobileNumber` (required)
- `workPhoneNumber` (optional)
- `gender` (required)
- `country` (required, ISO-3166-1 alpha-3)
- `city` (required)
- `dateOfBirth` (required, YYYY-MM-DD format)
- `language` (required)

## Performance

- **Target**: 5k rows render < 200ms initial paint
- **Large files**: Support up to 25k rows with web workers
- **Bundle size**: ≤ ~120KB gzip (tree-shaken dependencies)

## Development

### Adding New File Types

1. Extend the `FileParseResult` interface in `src/types/index.ts`
2. Add parsing logic in `src/utils/fileParser.ts`
3. Update the worker in `src/workers/parser.worker.ts`

### Custom Validation Rules

1. Modify the Yup schema in `src/validation/schema.ts`
2. Add cross-field validation rules as needed
3. Update error handling in components
