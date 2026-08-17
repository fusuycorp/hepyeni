"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/client";

export default function ShelfError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[Shelf Error Caught]:", error);
  }, [error]);

  return (
    <div className="py-12 flex items-center justify-center">
      <Card className="w-full max-w-md border-border/80 shadow-xs">
        <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">
              {t.shelf.pageTitle} Yüklenemedi
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Kitaplık kayıtları yüklenirken bir problemle karşılaşıldı.
            </p>
          </div>

          {error.digest && (
            <div className="w-full p-2 rounded bg-muted/40 border border-border/60 text-[10px] font-mono text-muted-foreground">
              Hata Kodu: {error.digest}
            </div>
          )}

          <Button
            onClick={() => reset()}
            size="sm"
            className="gap-2 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" />
            <span>Yeniden Dene</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
