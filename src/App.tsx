import { FileUpload } from "./components/FileUpload";
import { HeaderMapping } from "./components/HeaderMapping";
import { DataPreview } from "./components/DataPreview";
import { ImportProgress } from "./components/ImportProgress";
import { useMachine } from "@xstate/react";
import { importerMachine } from "./state/importer";
import "./App.css";
import { SheetSelection } from "./components/SheetSelection";

function App() {
  const [state, send] = useMachine(importerMachine);
  const { fileData, headerMappings, validatedData, importProgress } =
    state.context;

  console.log(state.context);
  console.log(state.value);

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
            onSheetSelected={(sheetNames, file) =>
              send({ type: "SHEET_SELECTION", data: { sheetNames, file } })
            }
          />
        )}

        {state.matches("sheetSelect") && fileData && (
          <SheetSelection
            onFileUploaded={fileData =>
              send({ type: "FILE_PARSED", data: fileData })
            }
          />
        )}

        {state.matches("mapping") && fileData && (
          <HeaderMapping
            onNext={headerMappings =>
              send({ type: "MAPPED", data: headerMappings })
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
