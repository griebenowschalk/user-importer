import { FileParseResult, User } from "@/types";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Typography } from "./ui/typography";
import { Container } from "./ui/container";
import UserColumnMatcher from "../lib/userColumnMatcher";

interface HeaderMappingProps {
  onNext: (mappings: Record<string, keyof User>) => void;
  fileData: FileParseResult;
  onBack: () => void;
}

export default function HeaderMapping({
  onBack,
  fileData,
  onNext,
}: HeaderMappingProps) {
  const originalHeaders = fileData.columnMapping.unmapped.concat(
    Object.keys(fileData.columnMapping.mapped)
  );

  const [currentMapping, setCurrentMapping] = useState(
    fileData.columnMapping.mapped
  );

  const unmappedHeaders = useMemo(() => {
    return originalHeaders.filter(h => !(h in currentMapping));
  }, [originalHeaders, currentMapping]);

  const availableUserFields = useMemo(() => {
    return UserColumnMatcher.getUnmappedUserFields(currentMapping);
  }, [currentMapping]);

  // console.log(availableUserFields);
  // console.log(unmappedHeaders);
  // console.log(currentMapping);
  // console.log(originalHeaders);

  const handleMappingChange = (
    sourceHeader: string,
    targetField: keyof User | null
  ) => {
    if (targetField === null) {
      // Remove mapping
      const newMapping = { ...currentMapping };
      delete newMapping[sourceHeader];
      setCurrentMapping(newMapping);
    } else {
      // Update mapping
      setCurrentMapping(prev => ({
        ...prev,
        [sourceHeader]: targetField,
      }));
    }
  };
  // Send final mappings when user clicks next
  const handleNext = () => {
    console.log("🔍 HeaderMapping - final mappings:", currentMapping);
    console.log("🔍 HeaderMapping - fileData rows sample:", fileData.rows[0]);
    onNext(currentMapping);
  };

  return (
    <Container>
      <Typography as="h2">Map Headers</Typography>
      <Typography as="p">Map your file headers to the user schema</Typography>
      <div className="flex flex-col gap-2">
        <Typography as="h4">Mapped Columns</Typography>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(currentMapping).map(([header, field]) => (
            <div
              className="flex flex-row items-center justify-between gap-2 border p-2 bg-blue-50 rounded"
              key={header}
            >
              <div className="flex flex-row items-center gap-2 overflow-hidden">
                <Typography as="h4">{header}</Typography>
                <span>→</span>
                <Typography as="h4" className="truncate">
                  {field}
                </Typography>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleMappingChange(header, null)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Show unmapped columns */}
      {unmappedHeaders.length > 0 && (
        <div className="flex flex-col gap-2">
          <Typography as="h4">Unmapped Columns</Typography>
          <div className="grid grid-cols-2 gap-2">
            {unmappedHeaders.map(header => (
              <div
                key={header}
                className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded mb-2 bg-gray-50"
              >
                <Typography as="h4" className="truncate">
                  {header}
                </Typography>
                <select
                  onChange={e => {
                    const field = e.target.value as keyof User;
                    handleMappingChange(header, field);
                  }}
                  className="bg-white border border-gray-200 rounded"
                >
                  <option value="">Select field...</option>
                  {availableUserFields.map(field => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-row gap-2 justify-end">
        <Button onClick={onBack}>Back</Button>
        <Button
          disabled={Object.keys(currentMapping).length === 0}
          onClick={handleNext}
        >
          Next
        </Button>
      </div>
    </Container>
  );
}
