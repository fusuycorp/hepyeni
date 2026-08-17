export const MEDIA_TYPES = ["book", "movie", "tv", "music", "podcast"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

