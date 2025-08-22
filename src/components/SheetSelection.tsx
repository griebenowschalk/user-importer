import { useMachine } from "@xstate/react";
import { importerMachine } from "@/state/importer";
import { FileParseResult } from "../types";
import { parseFileOptimized } from "../lib/workerClient";
import { useState } from "react";
import { Button } from "./ui/button";

interface SheetSelectionProps {
  onFileUploaded: (data: FileParseResult) => void;
}

export const SheetSelection = ({ onFileUploaded }: SheetSelectionProps) => {
  const [state] = useMachine(importerMachine);
  const [selectedSheet, setSelectedSheet] = useState<string[]>([]);
  const { sheetNames, file } = state.context;

  const handleSheetSelected = async () => {
    if (!file) return;
    const result = await parseFileOptimized(file, selectedSheet);
    onFileUploaded(result);
  };

  return (
    <div>
      <h2>Select a sheet</h2>
      <div>
        {sheetNames.map(sheetName => (
          <div
            onClick={() => setSelectedSheet(prev => [...prev, sheetName])}
            key={sheetName}
          >
            {sheetName}
          </div>
        ))}
      </div>
      <Button onClick={handleSheetSelected}>Next</Button>
    </div>
  );
};
