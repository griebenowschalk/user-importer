import { lazy, Suspense } from "react";
import { useMachine } from "@xstate/react";
import { importerMachine } from "./state/importer";
import "./App.css";
import { Typography } from "./components/ui/typography";

const FileUpload = lazy(() => import("./components/FileUpload"));
const HeaderMapping = lazy(() => import("./components/HeaderMapping"));
const DataPreview = lazy(() => import("./components/DataPreview"));
const ImportProgress = lazy(() => import("./components/ImportProgress"));
const SheetSelection = lazy(() => import("./components/SheetSelection"));

function App() {
  const [state, send] = useMachine(importerMachine);
  const {
    fileData,
    headerMappings,
    validatedData,
    importProgress,
    file,
    sheetNames,
  } = state.context;

  return (
    <div className="app">
      <header className="app-header">
        <Typography as="h1">User Importer</Typography>
        <Typography as="p">
          Import users from CSV, Excel, or JSON files
        </Typography>
      </header>

      <main className="app-main">
        {state.matches("upload") && (
          <Suspense fallback={<div>Loading...</div>}>
            <FileUpload
              onFileUploaded={fileData =>
                send({ type: "FILE_PARSED", data: fileData })
              }
              onSheetSelected={(sheetNames, file) =>
                send({ type: "SHEET_SELECTION", data: { sheetNames, file } })
              }
            />
          </Suspense>
        )}

        {state.matches("sheetSelect") && (
          <Suspense fallback={<div>Loading...</div>}>
            <SheetSelection
              sheetNames={sheetNames || []}
              file={file}
              onFileUploaded={fileData =>
                send({ type: "FILE_PARSED", data: fileData })
              }
              onBack={() => send({ type: "BACK" })}
            />
          </Suspense>
        )}

        {state.matches("mapping") && fileData && (
          <Suspense fallback={<div>Loading...</div>}>
            <HeaderMapping
              fileData={fileData}
              onNext={headerMappings =>
                send({ type: "MAPPED", data: headerMappings })
              }
              onBack={() => send({ type: "BACK" })}
            />
          </Suspense>
        )}

        {state.matches("preview") && fileData && headerMappings && (
          <Suspense fallback={<div>Loading...</div>}>
            <DataPreview
              fileData={fileData}
              mappings={headerMappings}
              validatedData={validatedData}
              onValidatedDataChange={validatedData =>
                send({ type: "VALIDATED", data: validatedData })
              }
              onNext={() =>
                send({
                  type: "PROGRESS",
                  data: importProgress || {
                    imported: 0,
                    failed: 0,
                    skipped: 0,
                    errors: [],
                    batchResults: [],
                  },
                })
              }
              onBack={() => send({ type: "BACK" })}
            />
          </Suspense>
        )}

        {state.matches("import") && validatedData && (
          <Suspense fallback={<div>Loading...</div>}>
            <ImportProgress
              data={validatedData}
              progress={importProgress}
              onProgressChange={importProgress =>
                send({ type: "PROGRESS", data: importProgress })
              }
              onBack={() => send({ type: "BACK" })}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
