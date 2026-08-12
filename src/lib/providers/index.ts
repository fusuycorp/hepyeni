import type { MediaType } from "@/lib/media-types";
import type { MediaProvider } from "./types";
import { googleBooksProvider } from "./google-books";
import { tmdbMovieProvider, tmdbTvProvider } from "./tmdb";
import { spotifyProvider } from "./spotify";
import { itunesPodcastProvider } from "./itunes-podcasts";

const providers: Partial<Record<MediaType, MediaProvider>> = {
  book: googleBooksProvider,
  movie: tmdbMovieProvider,
  tv: tmdbTvProvider,
  music: spotifyProvider,
  podcast: itunesPodcastProvider,
};

export function getProvider(mediaType: MediaType): MediaProvider {
  const provider = providers[mediaType];
  if (!provider) {
    throw new Error(`No search provider registered for media type "${mediaType}" yet`);
  }
  return provider;
}

export function isProviderAvailable(mediaType: MediaType): boolean {
  return mediaType in providers;
}
