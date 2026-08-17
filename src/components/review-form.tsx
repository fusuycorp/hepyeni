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
        toast.success("Değerlendirme kaydedildi.");
      } catch {
        toast.error("Değerlendirme kaydedilemedi — lütfen tekrar deneyin.");
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
            aria-label={`5 üzerinden ${n} yıldız ver`}
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
        placeholder="Grup ile düşüncelerinizi paylaşın (isteğe bağlı)..."
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
        {isPending ? "Kaydediliyor…" : hasExisting ? "Değerlendirmeyi güncelle" : "Değerlendirmeyi kaydet"}
      </Button>
    </form>
  );
}
