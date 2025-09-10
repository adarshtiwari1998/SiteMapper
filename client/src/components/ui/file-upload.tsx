import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudUpload } from "lucide-react";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  className?: string;
  "data-testid"?: string;
}

export function FileUpload({ accept, onFileSelect, className, "data-testid": testId }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
        isDragOver 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary'
      } ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      data-testid={testId}
    >
      <CloudUpload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">
        <span className="text-primary font-medium">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {accept === '.json' ? 'JSON files only' : 'Select a file'}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
