import type { MediaProvider, NormalizedSearchResult } from "./types";

type TmdbResult = {
  id: number;
  title?: string; // movie
  name?: string; // tv
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

function makeTmdbProvider(
  endpoint: "movie" | "tv",
  mediaType: "movie" | "tv",
): MediaProvider {
  return {
    mediaType,
    async search(query): Promise<NormalizedSearchResult[]> {
      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

      const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
      url.searchParams.set("query", query);
      url.searchParams.set("include_adult", "false");

      // Sent as a Bearer token (TMDB's v4 "API Read Access Token"), not the
      // `?api_key=` query param — keeps the credential out of URLs that get
      // recorded by request logging / APM tracing.
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new Error(`TMDB search failed: ${res.status}`);
      }

      const data = (await res.json()) as { results?: TmdbResult[] };

      return (data.results ?? []).map((item) => ({
        externalId: String(item.id),
        externalSource: "tmdb",
        title: item.title ?? item.name ?? "Untitled",
        creator: undefined,
        coverUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : undefined,
        metadata: {
          overview: item.overview,
          releaseDate: item.release_date ?? item.first_air_date,
        },
      }));
    },
  };
}

export const tmdbMovieProvider = makeTmdbProvider("movie", "movie");
export const tmdbTvProvider = makeTmdbProvider("tv", "tv");
