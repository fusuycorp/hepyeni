"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ponytail: error boundaries render outside the I18nProvider (a root-layout
// crash skips the provider entirely), so useTranslations() is unavailable and
// next/headers cookies() throws outside the Server Component request scope.
// We read the NEXT_LOCALE/locale cookie from document.cookie instead and fall
// back to Turkish. Upgrade path: SSR the boundary per-locale with a dedicated
// layout, or precompute locale-specific error bundles at build time.
const ERROR_COPY = {
  tr: {
    title: "Bir Hata Oluştu",
    desc: "Sunucu ile iletişim kurulurken veya sayfa işlenirken beklenmeyen bir durumla karşılaşıldı.",
    errorCode: "Hata Kodu",
    copyReport: "Raporu Kopyala",
    copied: "Kopyalandı",
    retry: "Yeniden Dene",
    circles: "Çemberlerim",
  },
  en: {
    title: "Something Went Wrong",
    desc: "An unexpected error occurred while loading or processing this page.",
    errorCode: "Error Code",
    copyReport: "Copy Report",
    copied: "Copied",
    retry: "Try Again",
    circles: "My Circles",
  },
} as const;

function getLocaleCookie(): keyof typeof ERROR_COPY {
  if (typeof document === "undefined") return "tr";
  const match = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
  return match?.[1] === "en" ? "en" : "tr";
}

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [locale, setLocale] = useState<keyof typeof ERROR_COPY>("tr");
  const copy = ERROR_COPY[locale];

  useEffect(() => {
    setLocale(getLocaleCookie());
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
              {copy.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {copy.desc}
            </p>
          </div>

          {error.digest && (
            <div className="w-full p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground flex items-center justify-between gap-2">
              <span>{copy.errorCode}: <strong className="text-foreground">{error.digest}</strong></span>
              <button
                type="button"
                onClick={handleCopyReport}
                className="text-[10px] font-sans text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? copy.copied : copy.copyReport}</span>
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
            <Button
              onClick={() => reset()}
              className="w-full sm:flex-1 gap-2 text-xs font-semibold h-9"
            >
              <RefreshCw className="size-3.5" />
              <span>{copy.retry}</span>
            </Button>

            <Link
              href="/groups"
              className={buttonVariants({
                variant: "outline",
                className: "w-full sm:flex-1 gap-2 text-xs font-medium h-9",
              })}
            >
              <Home className="size-3.5" />
              <span>{copy.circles}</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
