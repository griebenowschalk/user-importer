import { FileParseResult, HeaderMapping as HeaderMappingType } from "@/types";

interface HeaderMappingProps {
  fileData: FileParseResult;
  mappings: HeaderMappingType[];
  onMappingsChange: (mappings: HeaderMappingType[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function HeaderMapping({
  fileData: _fileData,
  mappings: _mappings,
  onMappingsChange: _onMappingsChange,
  onNext: _onNext,
  onBack: _onBack,
}: HeaderMappingProps) {
  return (
    <div className="header-mapping">
      <h2>Map Headers</h2>
      <p>Map your file headers to the user schema</p>
      {/* Header mapping implementation will go here */}
    </div>
  );
}
