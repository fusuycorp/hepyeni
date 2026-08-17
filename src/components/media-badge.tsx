import { BookOpen, Film, Tv, Disc3, Mic } from "lucide-react";
import type { MediaType } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_LABELS_TR } from "@/lib/media-types";
import { cn } from "@/lib/utils";

interface MediaBadgeProps {
  type: MediaType | string;
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

const MEDIA_ICONS = {
  book: BookOpen,
  movie: Film,
  tv: Tv,
  music: Disc3,
  podcast: Mic,
} as const;

const MEDIA_STYLES: Record<string, string> = {
  book: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  movie: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  tv: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  music: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  podcast: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

export function MediaBadge({
  type,
  size = "sm",
  className,
  showIcon = true,
}: MediaBadgeProps) {
  const Icon = MEDIA_ICONS[type as MediaType] ?? BookOpen;
  const label = (MEDIA_TYPE_LABELS_TR as Record<string, string>)[type] ?? MEDIA_TYPE_LABELS[type as MediaType] ?? type;
  const style = MEDIA_STYLES[type] ?? "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium border rounded-full select-none tracking-tight",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        style,
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            "shrink-0",
            size === "sm" ? "size-3" : "size-3.5"
          )}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}
