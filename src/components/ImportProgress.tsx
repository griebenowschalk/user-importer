import { ValidationError, ImportResult } from "@/types";

interface ImportProgressProps {
  data: { valid: any[]; errors: ValidationError[] };
  progress: ImportResult | null;
  onProgressChange: (progress: ImportResult) => void;
  onBack: () => void;
}

export function ImportProgress({
  data: _data,
  progress: _progress,
  onProgressChange: _onProgressChange,
  onBack: _onBack,
}: ImportProgressProps) {
  return (
    <div className="import-progress">
      <h2>Import Progress</h2>
      <p>Importing your data...</p>
      {/* Import progress implementation will go here */}
    </div>
  );
}
