"use client";

import { useTransition } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

export function MarkConsumedButton({
  onMark,
  direction = "consume",
  variant = "link",
  size = "xs",
  className,
  showIcon = false,
}: {
  onMark: () => Promise<void>;
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
            await onMark();
          } catch {
            toast.error(errorMessage);
          }
        })
      }
    >
      {showIcon && <Icon className="size-3.5 mr-1.5 shrink-0" />}
      {isPending ? t.common.working : label}
    </Button>
  );
}

