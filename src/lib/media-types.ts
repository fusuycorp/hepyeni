export const MEDIA_TYPES = ["book", "movie", "tv", "music", "podcast"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  book: "Book",
  movie: "Movie",
  tv: "TV Show",
  music: "Music",
  podcast: "Podcast",
};

export const MEDIA_TYPE_LABELS_TR: Record<MediaType, string> = {
  book: "Kitap",
  movie: "Film",
  tv: "Dizi",
  music: "Müzik",
  podcast: "Podcast",
};

export function getMediaTypeLabel(type: MediaType, locale: "tr" | "en" = "tr"): string {
  return locale === "tr" ? MEDIA_TYPE_LABELS_TR[type] : MEDIA_TYPE_LABELS[type];
}

