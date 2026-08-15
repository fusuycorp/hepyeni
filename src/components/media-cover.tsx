import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "w-9 h-13 text-[10px]",
  sm: "w-12 h-17 text-xs",
  md: "w-16 h-24 text-sm",
  lg: "w-22 h-32 text-base",
  xl: "w-28 h-40 text-lg",
} as const;

export function MediaCover({
  src,
  alt = "",
  size = "sm",
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const sizeClass = SIZES[size] || SIZES.sm;

  if (!src) {
    return (
      <div
        className={cn(
          sizeClass,
          "shrink-0 rounded-lg bg-muted/70 border border-border/60 flex items-center justify-center text-muted-foreground/60 shadow-2xs",
          className
        )}
        aria-hidden="true"
      >
        <BookOpen className="size-1/2 opacity-40" />
      </div>
    );
  }

  return (
    // Covers come from many external providers (Google Books, TMDB, Spotify,
    // iTunes) — using <img> avoids maintaining a remotePatterns allowlist
    // across all of them.
    <div
      className={cn(
        sizeClass,
        "shrink-0 relative overflow-hidden rounded-lg border border-border/60 bg-muted shadow-2xs",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
      />
    </div>
  );
}
