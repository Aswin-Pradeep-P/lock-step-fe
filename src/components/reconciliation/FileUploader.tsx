import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  label: string;
  description: string;
  accept: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function hasAllowedExtension(file: File): boolean {
  return ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
}

export function FileUploader({
  label,
  description,
  accept,
  files,
  onFilesChange,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const valid = Array.from(incoming).filter(hasAllowedExtension);
      if (valid.length === 0) return;
      const existingNames = new Set(files.map((f) => f.name));
      const deduped = valid.filter((f) => !existingNames.has(f.name));
      if (deduped.length > 0) {
        onFilesChange([...files, ...deduped]);
      }
    },
    [files, onFilesChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles],
  );

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeFile(idx)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
          files.length > 0 ? "p-4" : "p-8",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <input
          type="file"
          accept={accept}
          multiple
          onChange={handleInputChange}
          className="absolute inset-0 cursor-pointer opacity-0 z-10"
        />
        <div
          className={cn(
            "flex items-center gap-2 pointer-events-none",
            files.length > 0 ? "justify-center" : "flex-col text-center",
          )}
        >
          <div className={cn("rounded-full bg-muted", files.length > 0 ? "p-1.5" : "p-3")}>
            <Upload
              className={cn(
                "text-muted-foreground",
                files.length > 0 ? "h-4 w-4" : "h-6 w-6",
              )}
            />
          </div>
          <div>
            <p className={cn("font-medium", files.length > 0 ? "text-xs" : "text-sm")}>
              {files.length > 0 ? "Add more files" : label}
            </p>
            {files.length === 0 && (
              <>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
                <p className="text-xs text-muted-foreground">
                  Drag & drop or click to browse · multiple files supported
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
