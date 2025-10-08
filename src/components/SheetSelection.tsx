import { FileParseResult } from "../types";
import { parseFileOptimized } from "../lib/workerClient";
import { useState } from "react";
import { Button } from "./ui/button";
import { Typography } from "./ui/typography";
import { Container } from "./ui/container";
import { Checkbox } from "./ui/checkbox";
import ErrorDialog from "./ui/errorDialog";

interface SheetSelectionProps {
  onFileUploaded: (data: FileParseResult) => void;
  onBack: () => void;
  sheetNames: string[];
  file: File | null;
}

export default function SheetSelection({
  onFileUploaded,
  onBack,
  sheetNames,
  file,
}: SheetSelectionProps) {
  const [selectedSheet, setSelectedSheet] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSheetSelected = async () => {
    if (!file) return;
    setError(null);
    try {
      const result = await parseFileOptimized(file, selectedSheet);
      onFileUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  return (
    <Container>
      <Typography as="h2">Select a sheet</Typography>
      <div className="flex flex-col gap-2">
        {sheetNames.map(sheetName => (
          <div
            className="flex flex-row items-center justify-between gap-2 border p-2 rounded"
            key={sheetName}
          >
            <Typography as="h4">{sheetName}</Typography>
            <Checkbox
              checked={selectedSheet.includes(sheetName)}
              onCheckedChange={() =>
                setSelectedSheet(prev => [...prev, sheetName])
              }
            />
          </div>
        ))}
      </div>
      <div className="flex flex-row gap-2 justify-end">
        <Button onClick={onBack}>Back</Button>
        <Button
          disabled={selectedSheet.length === 0}
          onClick={handleSheetSelected}
        >
          Next
        </Button>
      </div>
      {error && <ErrorDialog onClose={() => setError(null)} error={error} />}
    </Container>
  );
}
