"use client";

import { useState } from "react";
import {
  Code,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Terminal,
} from "lucide-react";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";
import { getDiagnosticsAction } from "@/lib/actions/diagnostics";
import type { DiagnosticEntry } from "@/lib/errors";

export function DiagnosticModal({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const t = useTranslations();

  async function loadDiagnostics() {
    try {
      setLoading(true);
      const items = await getDiagnosticsAction();
      setDiagnostics(items);
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoading(false);
    }
  }

  async function copyReport(entry: DiagnosticEntry) {
    try {
      const report = JSON.stringify(entry, null, 2);
      await navigator.clipboard.writeText(report);
      setCopiedId(entry.traceId);
      toast.success(t.diagnostics.copied);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t.common.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) loadDiagnostics();
      }}
    >
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="ghost" size="xs" className="gap-1.5 text-xs text-muted-foreground">
              <Terminal className="size-3.5" />
              <span>{t.diagnostics.title}</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Terminal className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold">
                  {t.diagnostics.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {t.diagnostics.description}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={loadDiagnostics}
              disabled={loading}
              aria-label={t.common.refresh}
              title={t.common.refresh}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {diagnostics.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/70 p-6">
              <Code className="size-8 mx-auto opacity-30 mb-2" />
              <p>{t.diagnostics.noErrors}</p>
            </div>
          ) : (
            diagnostics.map((item) => (
              <div
                key={item.traceId}
                className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2.5 shadow-2xs text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                        {item.code}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {item.traceId}
                      </span>
                    </div>
                    <p className="font-medium text-foreground text-xs leading-snug">
                      {item.userMessage}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    className="shrink-0 gap-1 font-mono text-[11px]"
                    onClick={() => copyReport(item)}
                  >
                    {copiedId === item.traceId ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-mono">{item.action}</span>
                  <span>&middot;</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {item.technicalDetails && (
                  <pre className="p-2.5 rounded-lg bg-muted/80 text-[11px] font-mono text-muted-foreground overflow-x-auto border border-border/50 max-h-40">
                    {JSON.stringify(item.technicalDetails, null, 2)}
                  </pre>
                )}

                {item.stack && (
                  <details className="text-[11px] text-muted-foreground pt-1">
                    <summary className="cursor-pointer font-medium hover:text-foreground select-none">
                      {t.diagnostics.stack}
                    </summary>
                    <pre className="p-2.5 mt-1.5 rounded-lg bg-muted/80 text-[10px] font-mono text-muted-foreground overflow-x-auto border border-border/50 max-h-40">
                      {item.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
