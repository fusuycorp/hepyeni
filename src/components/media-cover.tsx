import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-16 w-11",
  md: "h-20 w-14",
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
  if (!src) {
    return (
      <div
        className={cn(SIZES[size], "shrink-0 rounded bg-muted", className)}
      />
    );
  }

  return (
    // Covers come from many external providers (Google Books, TMDB, Spotify,
    // iTunes) — using <img> avoids maintaining a remotePatterns allowlist
    // across all of them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(SIZES[size], "shrink-0 rounded object-cover", className)}
    />
  );
}
