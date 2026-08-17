"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[Next.js Global Error]:", error);
  }, [error]);

  return (
    <html lang="tr" className="h-full">
      <body className="h-full flex items-center justify-center p-4 bg-background text-foreground font-sans">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-lg flex flex-col items-center text-center space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-2xl font-bold">
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
            <div className="w-full p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground">
              Hata Kodu: <span className="text-foreground">{error.digest}</span>
            </div>
          )}

          <div className="flex items-center gap-3 w-full pt-2">
            <button
              onClick={() => retry()}
              className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Yeniden Dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
