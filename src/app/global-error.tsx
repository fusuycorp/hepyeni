"use client";

import { useEffect, useState } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("[Titirek Global Root Error Caught]:", {
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const handleCopyReport = () => {
    const report = {
      app: "Titirek",
      level: "critical_global",
      digest: error.digest || "none",
      message: error.message || "Unknown root error",
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <html lang="tr" className="h-full">
      <body className="h-full flex items-center justify-center p-4 bg-background text-foreground font-sans">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-lg flex flex-col items-center text-center space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-xl font-bold">
            !
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Kritik Sistem Hatası
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Uygulama yüklenirken beklenmeyen bir hata meydana geldi.
            </p>
          </div>

          {error.digest && (
            <div className="w-full p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground flex items-center justify-between gap-2">
              <span>Hata Kodu: <strong className="text-foreground">{error.digest}</strong></span>
              <button
                type="button"
                onClick={handleCopyReport}
                className="text-[10px] font-sans text-primary hover:underline"
              >
                {copied ? "Kopyalandı" : "Raporu Kopyala"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 w-full pt-2">
            <button
              onClick={() => reset()}
              className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Yeniden Dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
