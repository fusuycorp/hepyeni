"use client";

import { useState, useTransition } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toggleBlindPickMode } from "@/lib/actions/groups";
import { useTranslations } from "@/lib/i18n/client";
import { useFeatureFlag } from "@/lib/flags/client";
import { cn } from "@/lib/utils";

interface BlindPickToggleFormProps {
  groupId: string;
  initialEnabled?: boolean;
}

export function BlindPickToggleForm({
  groupId,
  initialEnabled = false,
}: BlindPickToggleFormProps) {
  const t = useTranslations();
  const flagEnabled = useFeatureFlag("blind_pick_wheel");
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);

  if (!flagEnabled) return null;

  const handleToggle = (nextVal: boolean) => {
    setEnabled(nextVal);
    startTransition(async () => {
      try {
        const res = await toggleBlindPickMode(groupId, nextVal);
        if (!res.success) {
          setEnabled(!nextVal); // revert
          toast.error(res.error || t.blindPick.updatedFailed);
          return;
        }
        toast.success(t.blindPick.updatedSuccess);
      } catch {
        setEnabled(!nextVal);
        toast.error(t.blindPick.updatedFailed);
      }
    });
  };

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <EyeOff className="size-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">
                {t.blindPick.title}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.blindPick.description}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={enabled ? "default" : "secondary"}
            className={cn(
              "text-[10px] font-semibold shrink-0",
              enabled && "bg-primary text-primary-foreground",
            )}
          >
            {enabled ? t.blindPick.enabledStatus : t.blindPick.disabledStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              {t.blindPick.toggleLabel}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t.blindPick.modeNotice}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={isPending}
              onClick={() => handleToggle(!enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                enabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-2xs transition duration-200 ease-in-out",
                  enabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
