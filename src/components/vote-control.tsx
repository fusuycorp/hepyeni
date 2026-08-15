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
}: VoteState & {
  onVote: (value: VoteValue) => Promise<void>;
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
    },
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

  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant={state.userVote === "up" ? "default" : "ghost"}
        aria-label="Upvote"
        aria-pressed={state.userVote === "up"}
        disabled={isPending}
        onClick={() => vote("up")}
      >
        <ChevronUp />
      </Button>
      <span
        className={cn(
          "text-xs font-medium tabular-nums text-muted-foreground",
          isPending && "opacity-60",
        )}
      >
        {state.score}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant={state.userVote === "down" ? "default" : "ghost"}
        aria-label="Downvote"
        aria-pressed={state.userVote === "down"}
        disabled={isPending}
        onClick={() => vote("down")}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
