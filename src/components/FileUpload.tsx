import { FileParseResult } from "@/types";
import { useDropzone } from "react-dropzone";
import { getFileSheetNames, parseFileOptimized } from "@/lib/workerClient";
import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Container } from "./ui/container";
import { checkIfExcel } from "../lib/utils";

interface FileUploadProps {
  onFileUploaded: (data: FileParseResult) => void;
  onSheetSelected?: (sheetNames: string[], file: File) => void;
}

export function FileUpload({
  onFileUploaded,
  onSheetSelected,
}: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      if (checkIfExcel(file.name)) {
        const sheetNames = await getFileSheetNames(file);
        if (sheetNames.length > 1) {
          onSheetSelected?.(sheetNames, file);
          return;
        }
      }

      const result = await parseFileOptimized(file);
      onFileUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    handleFile(file);
  }, []);

  const {
    getRootProps,
    getInputProps,
    open: browse,
  } = useDropzone({
    onDrop,
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
    accept: {
      "image/*": [".xls", ".xlsx", ".csv", ".json"],
    },
  });

  return (
    <Container>
      <h2>Upload File</h2>
      <p>Upload your CSV, Excel, or JSON file to get started</p>
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-300"
      >
        <input disabled={isLoading} {...getInputProps()} />
        <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 p-4">
          <p>Drag and drop a file here, or click to browse</p>
          <Button
            className="mb-4 cursor-pointer"
            disabled={isLoading}
            onClick={browse}
            variant="secondary"
          >
            Browse
          </Button>
        </div>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {isLoading && <p>Loading...</p>}
    </Container>
  );
}
