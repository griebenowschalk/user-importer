import { FileParseResult } from "@/types";
import { useDropzone } from "react-dropzone";
import { getFileSheetNames, parseFileOptimized } from "@/lib/workerClient";
import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Container } from "./ui/container";
import { checkIfExcel } from "../lib/utils";
import { Typography } from "./ui/typography";
import { Download } from "lucide-react";
import { downloadExcelTemplate, downloadCSVTemplate } from "@/lib/templates";
import ErrorDialog from "./ui/errorDialog";

interface FileUploadProps {
  onFileUploaded: (data: FileParseResult) => void;
  onSheetSelected?: (sheetNames: string[], file: File) => void;
}

export default function FileUpload({
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

  const downloadTemplate = (format: string) => {
    if (format === "excel") {
      downloadExcelTemplate();
      return;
    }

    downloadCSVTemplate();
  };

  return (
    <Container>
      <Typography as="h2">Upload File</Typography>
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => downloadTemplate("excel")} variant="outline">
          <Download />
          Excel Template
        </Button>
        <Button onClick={() => downloadTemplate("csv")} variant="outline">
          <Download />
          CSV Template
        </Button>
      </div>
      <Typography as="p">
        Upload your CSV, Excel, or JSON file to get started
      </Typography>
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-300 rounded-md"
      >
        <input disabled={isLoading} {...getInputProps()} />
        <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 p-4">
          <Typography as="p">
            Drag and drop a file here, or click to browse
          </Typography>
          <Button className="mb-4" disabled={isLoading} onClick={browse}>
            Browse
          </Button>
        </div>
      </div>
      {error && <ErrorDialog error={error} onClose={() => setError(null)} />}
      {isLoading && <p>Loading...</p>}
    </Container>
  );
}
