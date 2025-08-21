import { FileParseResult } from "@/types";

interface FileUploadProps {
  onFileUploaded: (data: FileParseResult) => void;
  onNext: () => void;
}

export function FileUpload({
  onFileUploaded: _onFileUploaded,
  onNext: _onNext,
}: FileUploadProps) {
  return (
    <div className="file-upload">
      <h2>Upload File</h2>
      <p>Upload your CSV, Excel, or JSON file to get started</p>
      {/* File upload implementation will go here */}
    </div>
  );
}
