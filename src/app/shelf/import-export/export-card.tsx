"use client";

import { useState, useTransition } from "react";
import {
  FileJson,
  FileSpreadsheet,
  FolderArchive,
  Download,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportShelfData } from "@/lib/actions/import-export";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function ExportCard() {
  const t = useTranslations();
  const [activeFormat, setActiveFormat] = useState<"json" | "csv" | "markdown" | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDownload = (format: "json" | "csv" | "markdown") => {
    setActiveFormat(format);
    startTransition(async () => {
      try {
        const res = await exportShelfData(format);
        if (!res.success) {
          toast.error(res.error || t.importExport.exportFailed, {
            description: res.traceId ? `Trace ID: ${res.traceId}` : undefined,
          });
          return;
        }

        let blob: Blob;
        if (res.data.isBase64) {
          const byteChars = atob(res.data.data);
          const byteNumbers = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          blob = new Blob([byteNumbers], { type: res.data.mimeType });
        } else {
          blob = new Blob([res.data.data], { type: res.data.mimeType });
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(t.importExport.exportSuccess);
      } catch (err) {
        toast.error(t.importExport.exportFailed);
      } finally {
        setActiveFormat(null);
      }
    });
  };

  const exportOptions = [
    {
      id: "json" as const,
      title: t.importExport.exportJsonTitle,
      description: t.importExport.exportJsonDesc,
      buttonLabel: t.importExport.exportJsonButton,
      icon: FileJson,
      iconColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "csv" as const,
      title: t.importExport.exportCsvTitle,
      description: t.importExport.exportCsvDesc,
      buttonLabel: t.importExport.exportCsvButton,
      icon: FileSpreadsheet,
      iconColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "markdown" as const,
      title: t.importExport.exportMarkdownTitle,
      description: t.importExport.exportMarkdownDesc,
      buttonLabel: t.importExport.exportMarkdownButton,
      icon: FolderArchive,
      iconColor: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-border/80 bg-card/60 space-y-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span>{t.importExport.exportTitle}</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          {t.importExport.exportSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exportOptions.map((opt) => {
          const Icon = opt.icon;
          const isLoadingThis = isPending && activeFormat === opt.id;

          return (
            <Card
              key={opt.id}
              className="group border border-border/80 bg-card/60 hover:bg-card/90 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border",
                      opt.iconColor,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      {opt.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDownload(opt.id)}
                    className="w-full text-xs font-medium gap-2 justify-center group-hover:border-primary/50 group-hover:text-primary transition-colors"
                  >
                    {isLoadingThis ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>{t.importExport.exporting}</span>
                      </>
                    ) : (
                      <>
                        <Download className="size-3.5" />
                        <span>{opt.buttonLabel}</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
