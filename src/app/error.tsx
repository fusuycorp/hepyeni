"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors to console / monitoring
    console.error("[Next.js Error Boundary caught error]:", error);
  }, [error]);

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
              Sunucu ile iletişim kurulurken veya sayfa yüklenirken bir problemle karşılaşıldı.
            </p>
          </div>

          {error.digest && (
            <div className="w-full p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground">
              Hata Kodu (Digest): <span className="text-foreground">{error.digest}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
            <Button
              onClick={() => retry()}
              className="w-full sm:flex-1 gap-2 text-xs font-semibold h-9"
            >
              <RefreshCw className="size-3.5" />
              <span>Yeniden Dene</span>
            </Button>

            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                className: "w-full sm:flex-1 gap-2 text-xs font-medium h-9",
              })}
            >
              <LogIn className="size-3.5" />
              <span>Giriş Yap</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
