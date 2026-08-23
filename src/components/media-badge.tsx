"use client";

import { BookOpen, Film, Tv, Disc3, Mic } from "lucide-react";
import type { MediaType } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

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
  const t = useTranslations();
  const Icon = MEDIA_ICONS[type as MediaType] ?? BookOpen;
  const label = (t.media as Record<string, string>)[type] ?? type;
  const style = MEDIA_STYLES[type] ?? "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium border rounded-xs select-none tracking-tight",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
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
