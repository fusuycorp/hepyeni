"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MarkConsumedButton({
  onMark,
}: {
  onMark: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      className="h-auto self-start p-0 text-xs font-medium text-muted-foreground underline underline-offset-2"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await onMark();
          } catch {
            toast.error("Tamamlandı olarak işaretlenemedi — lütfen tekrar deneyin.");
          }
        })
      }
    >
      {isPending ? "İşleniyor…" : "Tamamlandı olarak işaretle"}
    </Button>
  );
}
