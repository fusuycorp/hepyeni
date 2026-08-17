"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";

export function MarkConsumedButton({
  onMark,
}: {
  onMark: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

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
            toast.error(t.media.markConsumedFailed);
          }
        })
      }
    >
      {isPending ? t.common.working : t.media.markAsConsumed}
    </Button>
  );
}
