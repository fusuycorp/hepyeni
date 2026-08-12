export const MEDIA_TYPES = ["book", "movie", "tv", "music", "podcast"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  book: "Book",
  movie: "Movie",
  tv: "TV Show",
  music: "Music",
  podcast: "Podcast",
};
