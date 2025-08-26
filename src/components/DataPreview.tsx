import {
  FileParseResult,
  HeaderMapping as HeaderMappingType,
  ValidationError,
} from "@/types";

interface DataPreviewProps {
  fileData: FileParseResult;
  mappings: HeaderMappingType[];
  validatedData: {
    valid: any[];
    errors: ValidationError[];
  } | null;
  onValidatedDataChange: (data: {
    valid: any[];
    errors: ValidationError[];
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function DataPreview({
  fileData: _fileData,
  mappings: _mappings,
  validatedData: _validatedData,
  onValidatedDataChange: _onValidatedDataChange,
  onNext: _onNext,
  onBack: _onBack,
}: DataPreviewProps) {
  return (
    <div className="data-preview">
      <h2>Preview & Validate</h2>
      <p>Review your data before importing</p>
      {/* Data preview implementation will go here */}
    </div>
  );
}
