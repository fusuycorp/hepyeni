"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";

export function MarkConsumedButton({
  onMark,
  direction = "consume",
}: {
  onMark: () => Promise<void>;
  direction?: "consume" | "unconsume";
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();
  const label = direction === "consume" ? t.media.markAsConsumed : t.media.markAsUnconsumed;
  const errorMessage =
    direction === "consume" ? t.media.markConsumedFailed : t.media.unmarkConsumedFailed;

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
            toast.error(errorMessage);
          }
        })
      }
    >
      {isPending ? t.common.working : label}
    </Button>
  );
}
