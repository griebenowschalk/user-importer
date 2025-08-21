import { FileParseResult } from "@/types";
import { useDropzone } from "react-dropzone";
import { parseFileOptimized } from "@/lib/workerClient";
import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Container } from "./ui/container";

interface FileUploadProps {
  onFileUploaded: (data: FileParseResult) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await parseFileOptimized(file);
      console.log("result", result);
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
