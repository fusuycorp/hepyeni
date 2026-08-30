"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";

type VoteValue = "up" | "down";
type VoteState = { score: number; userVote?: VoteValue };

export function VoteControl({
  score,
  userVote,
  onVote,
  orientation = "vertical",
  disabled = false,
}: VoteState & {
  onVote?: (value: VoteValue) => Promise<ActionResult<void> | void>;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();
  const effectiveDisabled = disabled || !onVote || isPending;
  const [state, applyOptimistic] = useOptimistic(
    { score, userVote } as VoteState,
    (current, value: VoteValue): VoteState => {
      if (current.userVote === value) {
        return { score: current.score + (value === "up" ? -1 : 1) };
      }
      const delta = current.userVote ? 2 : 1;
      return {
        score: current.score + (value === "up" ? delta : -delta),
        userVote: value,
      };
    }
  );

  function vote(value: VoteValue) {
    if (!onVote || effectiveDisabled) return;
    startTransition(async () => {
      applyOptimistic(value);
      try {
        const res = await onVote(value);
        if (res && typeof res === "object" && "success" in res && !res.success) {
          toast.error(res.error || t.media.voteFailed, {
            description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
          });
        }
      } catch {
        toast.error(t.media.voteFailed);
      }
    });
  }

  const isUp = state.userVote === "up";
  const isDown = state.userVote === "down";

  if (orientation === "horizontal") {
    return (
      <div className="inline-flex items-center gap-1 rounded-xs bg-muted/60 p-1 border border-border/60">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.media.upvoteAria}
          aria-pressed={isUp}
          disabled={effectiveDisabled}
          onClick={() => vote("up")}
          className={cn(
            "size-8 rounded-xs transition-all active:scale-90",
            isUp
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-600"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronUp className="size-4" />
        </Button>
        <span
          className={cn(
            "min-w-6 text-center text-xs font-mono font-bold tabular-nums",
            state.score > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : state.score < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground",
            isPending && "opacity-60"
          )}
        >
          {state.score}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.media.downvoteAria}
          aria-pressed={isDown}
          disabled={effectiveDisabled}
          onClick={() => vote("down")}
          className={cn(
            "size-8 rounded-xs transition-all active:scale-90",
            isDown
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 hover:text-rose-600"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center justify-center rounded-xs bg-muted/40 p-1 border border-border/60">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t.media.upvoteAria}
        aria-pressed={isUp}
        disabled={effectiveDisabled}
        onClick={() => vote("up")}
        className={cn(
          "size-8 rounded-xs transition-all active:scale-90",
          isUp
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-600"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ChevronUp className="size-4.5" />
      </Button>

      <span
        className={cn(
          "py-0.5 text-xs font-mono font-bold tabular-nums leading-none tracking-tight",
          state.score > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : state.score < 0
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground",
          isPending && "opacity-60"
        )}
      >
        {state.score}
      </span>

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t.media.downvoteAria}
        aria-pressed={isDown}
        disabled={effectiveDisabled}
        onClick={() => vote("down")}
        className={cn(
          "size-8 rounded-xs transition-all active:scale-90",
          isDown
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 hover:text-rose-600"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ChevronDown className="size-4.5" />
      </Button>
    </div>
  );
}
