"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";

export function ReviewForm({
  defaultRating,
  defaultText,
  hasExisting,
  onSubmit,
}: {
  defaultRating: number;
  defaultText: string;
  hasExisting: boolean;
  onSubmit: (formData: FormData) => Promise<ActionResult<void> | void>;
}) {
  const [rating, setRating] = useState(defaultRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await onSubmit(formData);
        if (res && typeof res === "object" && "success" in res && !res.success) {
          toast.error(res.error || t.reviews.reviewSaveFailed, {
            description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
          });
          return;
        }
        toast.success(t.reviews.reviewSaved);
      } catch {
        toast.error(t.reviews.reviewSaveFailed);
      }
    });
  }

  const shown = hovered ?? rating;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div
        className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/30 w-fit border border-border/40"
        onMouseLeave={() => setHovered(null)}
      >
        <input type="hidden" name="rating" value={rating} />
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t.reviews.starAriaLabel.replace("{n}", String(n))}
            aria-pressed={rating === n}
            onMouseEnter={() => setHovered(n)}
            onClick={() => setRating(n)}
            className="p-1 rounded-md transition-transform hover:scale-110 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={cn(
                "size-5 transition-colors",
                n <= shown
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
      <Textarea
        name="reviewText"
        defaultValue={defaultText}
        placeholder={t.reviews.notesPlaceholder}
        rows={2}
        className="text-xs resize-y min-h-[60px]"
      />
      <Button
        type="submit"
        variant="secondary"
        size="xs"
        className="self-start font-medium"
        disabled={isPending}
      >
        {isPending ? t.common.saving : hasExisting ? t.reviews.updateReview : t.reviews.saveReview}
      </Button>
    </form>
  );
}
