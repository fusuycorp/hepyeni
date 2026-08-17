"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Structured error logging in browser console
    console.error("[Titirek Application Error Caught]:", {
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const handleCopyReport = () => {
    const report = {
      app: "Titirek",
      digest: error.digest || "none",
      message: error.message || "Unknown client/server error",
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-md border-border/80 shadow-lg">
        <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Bir Hata Oluştu
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Sunucu ile iletişim kurulurken veya sayfa işlenirken beklenmeyen bir durumla karşılaşıldı.
            </p>
          </div>

          {error.digest && (
            <div className="w-full p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground flex items-center justify-between gap-2">
              <span>Hata Kodu: <strong className="text-foreground">{error.digest}</strong></span>
              <button
                type="button"
                onClick={handleCopyReport}
                className="text-[10px] font-sans text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? "Kopyalandı" : "Raporu Kopyala"}</span>
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
            <Button
              onClick={() => reset()}
              className="w-full sm:flex-1 gap-2 text-xs font-semibold h-9"
            >
              <RefreshCw className="size-3.5" />
              <span>Yeniden Dene</span>
            </Button>

            <Link
              href="/groups"
              className={buttonVariants({
                variant: "outline",
                className: "w-full sm:flex-1 gap-2 text-xs font-medium h-9",
              })}
            >
              <Home className="size-3.5" />
              <span>Çemberlerim</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
