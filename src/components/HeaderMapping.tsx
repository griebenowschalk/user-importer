import { HeaderMapping as HeaderMappingType } from "@/types";
import { useMachine } from "@xstate/react";
import { useState } from "react";
import { importerMachine } from "../state/importer";
import { Button } from "./ui/button";

interface HeaderMappingProps {
  onNext: (mappings: HeaderMappingType[]) => void;
  onBack: () => void;
}

export function HeaderMapping({ onNext, onBack }: HeaderMappingProps) {
  const [state] = useMachine(importerMachine);
  const { fileData, headerMappings } = state.context;
  const [localMappings, setLocalMappings] = useState<HeaderMappingType[]>(
    headerMappings.length > 0 ? headerMappings : []
  );

  console.log(fileData, headerMappings);

  // Update mappings locally as user types
  const handleMappingChange = (mappings: HeaderMappingType[]) => {
    setLocalMappings(mappings);
  };

  // Send final mappings when user clicks next
  const handleNext = () => {
    onNext(localMappings);
  };

  return (
    <div className="header-mapping">
      <h2>Map Headers</h2>
      <p>Map your file headers to the user schema</p>
      <Button onClick={() => handleMappingChange(localMappings)}>Map</Button>
      {/* Header mapping implementation will go here */}
      <Button onClick={handleNext}>Next</Button>
      <Button onClick={onBack}>Back</Button>
    </div>
  );
}
