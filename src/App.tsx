import { FileUpload } from "./components/FileUpload";
import { HeaderMapping } from "./components/HeaderMapping";
import { DataPreview } from "./components/DataPreview";
import { ImportProgress } from "./components/ImportProgress";
import { useMachine } from "@xstate/react";
import { importerMachine } from "./state/importer";
import "./App.css";

function App() {
  const [state, send] = useMachine(importerMachine);
  const { fileData, headerMappings, validatedData, importProgress } =
    state.context;

  return (
    <div className="app">
      <header className="app-header">
        <h1>User Importer</h1>
        <p>Import users from CSV, Excel, or JSON files</p>
      </header>

      <main className="app-main">
        {state.matches("upload") && (
          <FileUpload
            onFileUploaded={fileData =>
              send({ type: "FILE_PARSED", data: fileData })
            }
            onNext={() => send({ type: "MAPPED", data: headerMappings })}
          />
        )}

        {state.matches("mapping") && fileData && (
          <HeaderMapping
            fileData={fileData}
            mappings={headerMappings}
            onMappingsChange={headerMappings =>
              send({ type: "MAPPED", data: headerMappings })
            }
            onNext={() =>
              send({
                type: "VALIDATED",
                data: validatedData || { valid: [], errors: [] },
              })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}

        {state.matches("preview") && fileData && headerMappings && (
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
        )}

        {state.matches("import") && validatedData && (
          <ImportProgress
            data={validatedData}
            progress={importProgress}
            onProgressChange={importProgress =>
              send({ type: "PROGRESS", data: importProgress })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
      </main>
    </div>
  );
}

export default App;
