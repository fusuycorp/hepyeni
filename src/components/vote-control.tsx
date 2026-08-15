"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoteValue = "up" | "down";
type VoteState = { score: number; userVote?: VoteValue };

export function VoteControl({
  score,
  userVote,
  onVote,
  orientation = "vertical",
}: VoteState & {
  onVote: (value: VoteValue) => Promise<void>;
  orientation?: "vertical" | "horizontal";
}) {
  const [isPending, startTransition] = useTransition();
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
    startTransition(async () => {
      applyOptimistic(value);
      try {
        await onVote(value);
      } catch {
        toast.error("Couldn't record your vote — try again.");
      }
    });
  }

  const isUp = state.userVote === "up";
  const isDown = state.userVote === "down";

  if (orientation === "horizontal") {
    return (
      <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/60">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Upvote"
          aria-pressed={isUp}
          disabled={isPending}
          onClick={() => vote("up")}
          className={cn(
            "size-8 rounded-lg transition-all active:scale-90",
            isUp
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-600"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronUp className="size-4" />
        </Button>
        <span
          className={cn(
            "min-w-6 text-center text-xs font-bold tabular-nums",
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
          aria-label="Downvote"
          aria-pressed={isDown}
          disabled={isPending}
          onClick={() => vote("down")}
          className={cn(
            "size-8 rounded-lg transition-all active:scale-90",
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
    <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-muted/40 p-1 border border-border/50">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Upvote"
        aria-pressed={isUp}
        disabled={isPending}
        onClick={() => vote("up")}
        className={cn(
          "size-8 rounded-lg transition-all active:scale-90",
          isUp
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-600"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ChevronUp className="size-4.5" />
      </Button>

      <span
        className={cn(
          "py-0.5 text-xs font-bold tabular-nums leading-none tracking-tight",
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
        aria-label="Downvote"
        aria-pressed={isDown}
        disabled={isPending}
        onClick={() => vote("down")}
        className={cn(
          "size-8 rounded-lg transition-all active:scale-90",
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
