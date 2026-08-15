"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ReviewForm({
  defaultRating,
  defaultText,
  hasExisting,
  onSubmit,
}: {
  defaultRating: number;
  defaultText: string;
  hasExisting: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [rating, setRating] = useState(defaultRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        toast.success("Review saved.");
      } catch {
        toast.error("Couldn't save your review — try again.");
      }
    });
  }

  const shown = hovered ?? rating;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        <input type="hidden" name="rating" value={rating} />
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} out of 5`}
            aria-pressed={rating === n}
            onMouseEnter={() => setHovered(n)}
            onClick={() => setRating(n)}
            className="p-0.5 text-muted-foreground"
          >
            <Star
              className={cn(
                "size-4",
                n <= shown && "fill-primary text-primary",
              )}
            />
          </button>
        ))}
      </div>
      <Textarea
        name="reviewText"
        defaultValue={defaultText}
        placeholder="Thoughts? (optional)"
        rows={2}
        className="text-sm"
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={isPending}
      >
        {isPending ? "Saving…" : hasExisting ? "Update review" : "Save review"}
      </Button>
    </form>
  );
}
