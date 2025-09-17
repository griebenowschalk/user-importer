import { ValidationError } from "@/types";
import { useEffect } from "react";
import { Button } from "./ui/button";

interface ImportProgressProps {
  data: { valid: any[]; errors: ValidationError[] };
  onBack: () => void;
}

export default function ImportProgress({
  data,
  onBack: _onBack,
}: ImportProgressProps) {
  useEffect(() => {
    data.valid.forEach((row: any) => {
      if (!row.email) delete row.email;
    });
  }, [data]);

  return (
    <div className="import-progress">
      <h2>Data Clean & Validated</h2>
      <p>Cleaned & validated {data.valid.length} rows</p>
      <p>Found {data.errors.length} errors</p>
      <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
        {JSON.stringify(data.valid, null, 2)}
      </pre>
      <Button onClick={_onBack}>Back</Button>
    </div>
  );
}
