"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown, UploadCloud, DownloadCloud, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDropzone } from "./import-dropzone";
import { ImportPreviewTable } from "./import-preview-table";
import { ExportCard } from "./export-card";
import { AiExtractCard } from "./ai-extract-card";
import { useTranslations } from "@/lib/i18n/client";
import { useFeatureFlag } from "@/lib/flags/client";
import { cn } from "@/lib/utils";
import type { ImportSource, NormalizedImportItem } from "@/lib/importers";

export function ImportExportView() {
  const t = useTranslations();
  const isExtractEnabled = useFeatureFlag("llm_extract");
  const [activeTab, setActiveTab] = useState<"import" | "export" | "text">("import");
  const [parsedData, setParsedData] = useState<{
    items: NormalizedImportItem[];
    source: ImportSource;
    filename: string;
  } | null>(null);

  const handleClear = () => {
    setParsedData(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/shelf">
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label={t.importExport.backToShelf}
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-5 text-primary shrink-0" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {t.importExport.pageTitle}
              </h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pl-10 sm:pl-10">
            {t.importExport.pageSubtitle}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          role="tablist"
          className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "import"}
            onClick={() => setActiveTab("import")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "import"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UploadCloud className="size-3.5" />
            <span>{t.importExport.importTab}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "export"}
            onClick={() => setActiveTab("export")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "export"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <DownloadCloud className="size-3.5" />
            <span>{t.importExport.exportTab}</span>
          </button>
          {isExtractEnabled && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "text"}
              onClick={() => setActiveTab("text")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === "text"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="size-3.5" />
              <span>{t.importExport.fromTextTab}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === "import" && (
        <div className="space-y-6">
          <ImportDropzone
            onParsed={setParsedData}
            onClear={handleClear}
            hasItems={!!parsedData && parsedData.items.length > 0}
            currentFilename={parsedData?.filename}
            currentSource={parsedData?.source}
            currentCount={parsedData?.items.length}
          />

          {parsedData && parsedData.items.length > 0 && (
            <ImportPreviewTable
              items={parsedData.items}
              onSuccess={() => setParsedData(null)}
            />
          )}
        </div>
      )}

      {activeTab === "export" && <ExportCard />}

      {activeTab === "text" && isExtractEnabled && <AiExtractCard onBack={() => setActiveTab("import")} />}
    </div>
  );
}
