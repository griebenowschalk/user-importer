import {
  FileParseResult,
  HeaderMapping as HeaderMappingType,
  User,
} from "@/types";
import { useState } from "react";
import { Button } from "./ui/button";
import UserColumnMatcher from "../lib/userColumnMatcher";

interface HeaderMappingProps {
  onNext: (mappings: HeaderMappingType[]) => void;
  fileData: FileParseResult;
  onBack: () => void;
}

export function HeaderMapping({ onBack, fileData }: HeaderMappingProps) {
  const [currentMapping, setCurrentMapping] = useState(
    fileData?.columnMapping.mapped || {}
  );
  const [unmappedHeaders] = useState(fileData?.columnMapping.unmapped || []);
  const availableUserFields =
    UserColumnMatcher.getUnmappedUserFields(currentMapping);

  console.log(fileData);

  const handleMappingChange = (
    sourceHeader: string,
    targetField: keyof User | null
  ) => {
    const newMapping = UserColumnMatcher.updateMapping(
      currentMapping,
      sourceHeader,
      targetField
    );
    setCurrentMapping(newMapping);
  };

  // Send final mappings when user clicks next
  const handleNext = () => {
    //onNext(currentMapping);
  };

  return (
    <div className="header-mapping">
      <h2>Map Headers</h2>
      <p>Map your file headers to the user schema</p>
      <div>
        <h4>Mapped Columns</h4>
        {Object.entries(currentMapping).map(([header, field]) => (
          <div key={header}>
            <span>{header}</span>
            <span>→</span>
            <span>{field}</span>
            <button onClick={() => handleMappingChange(header, null)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Show unmapped columns */}
      {availableUserFields.length > 0 && (
        <div>
          <h4>Unmapped Columns</h4>
          {unmappedHeaders.map(header => (
            <div key={header}>
              <span>{header}</span>
              <span>→</span>
              <select
                onChange={e => {
                  const field = e.target.value as keyof User;
                  handleMappingChange(header, field);
                }}
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
      )}

      {/* Header mapping implementation will go here */}
      <Button onClick={handleNext}>Next</Button>
      <Button onClick={onBack}>Back</Button>
    </div>
  );
}
