"use client";

import { useTransition } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";

export function MarkConsumedButton({
  onMark,
  direction = "consume",
  variant = "link",
  size = "xs",
  className,
  showIcon = false,
}: {
  onMark: () => Promise<ActionResult<void> | void>;
  direction?: "consume" | "unconsume";
  variant?: "link" | "outline" | "default" | "ghost" | "secondary";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  showIcon?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();
  const label =
    direction === "consume" ? t.media.markAsConsumed : t.media.markAsUnconsumed;
  const errorMessage =
    direction === "consume"
      ? t.media.markConsumedFailed
      : t.media.unmarkConsumedFailed;

  const Icon = direction === "consume" ? CheckCircle2 : RotateCcw;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        variant === "link" &&
          "h-auto self-start p-0 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground",
        className,
      )}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await onMark();
            if (res && typeof res === "object" && "success" in res && !res.success) {
              toast.error(res.error || errorMessage, {
                description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
              });
            }
          } catch {
            toast.error(errorMessage);
          }
        })
      }
    >
      {showIcon && (
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            direction === "consume"
              ? "text-emerald-500 fill-emerald-500/20"
              : "text-muted-foreground",
          )}
        />
      )}
      <span>{isPending ? t.common.working : label}</span>
    </Button>
  );
}
