"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseImportFile, type ImportSource, type NormalizedImportItem } from "@/lib/importers";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface ImportDropzoneProps {
  onParsed: (data: {
    items: NormalizedImportItem[];
    source: ImportSource;
    filename: string;
  }) => void;
  onClear: () => void;
  hasItems: boolean;
  currentFilename?: string;
  currentSource?: ImportSource;
  currentCount?: number;
}

export function ImportDropzone({
  onParsed,
  onClear,
  hasItems,
  currentFilename,
  currentSource,
  currentCount,
}: ImportDropzoneProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFormatLabel = (source?: ImportSource): string => {
    switch (source) {
      case "goodreads":
        return t.importExport.formatGoodreads;
      case "letterboxd":
        return t.importExport.formatLetterboxd;
      case "storygraph":
        return t.importExport.formatStorygraph;
      case "titirek_json":
        return t.importExport.formatTitirekJson;
      case "generic_csv":
        return t.importExport.formatGenericCsv;
      default:
        return t.importExport.formatUnknown;
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error(t.importExport.fileSizeExceeded);
      }

      const content = await file.text();
      const result = parseImportFile(content, file.name);

      if (result.items.length === 0) {
        const errorMsg =
          result.errors.length > 0 ? result.errors[0] : t.importExport.emptyFile;
        setError(errorMsg);
      } else {
        onParsed({
          items: result.items,
          source: result.source,
          filename: file.name,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.importExport.emptyFile;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleReset = () => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClear();
  };

  if (hasItems && currentFilename) {
    return (
      <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                {currentFilename}
              </span>
              <Badge variant="secondary" className="text-[11px] font-medium bg-primary/10 text-primary border-primary/20">
                {getFormatLabel(currentSource)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.importExport.itemsFound.replace("{count}", String(currentCount ?? 0))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>{t.importExport.changeFile}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            <X className="size-3.5" />
            <span>{t.importExport.clearFile}</span>
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={t.importExport.dropzoneTitle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative group cursor-pointer p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all duration-200 text-center flex flex-col items-center justify-center gap-3",
          isDragging
            ? "border-primary bg-primary/5 shadow-inner scale-[0.99]"
            : "border-border/70 hover:border-primary/50 bg-card/30 hover:bg-card/60",
          isLoading && "pointer-events-none opacity-60",
        )}
      >
        <div className="size-12 rounded-2xl bg-muted/80 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors flex items-center justify-center border border-border/50 shadow-2xs">
          <UploadCloud className="size-6" />
        </div>

        <div className="space-y-1 max-w-md">
          <p className="text-sm font-semibold text-foreground">
            {isDragging ? t.importExport.dropzoneDragActive : t.importExport.dropzoneTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.importExport.dropzoneDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
            {t.importExport.dropzoneSupportedFormats}
          </Badge>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium">
              {t.importExport.parsingError.replace("{error}", error)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
