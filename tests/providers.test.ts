import { describe, expect, it } from "bun:test";
import { getProvider, isProviderAvailable } from "@/lib/providers";
import { googleBooksProvider } from "@/lib/providers/google-books";
import { itunesPodcastProvider } from "@/lib/providers/itunes-podcasts";
import { tmdbMovieProvider, tmdbTvProvider } from "@/lib/providers/tmdb";
import { spotifyProvider } from "@/lib/providers/spotify";

describe("Media Providers Registry", () => {
  it("resolves the correct provider for each media type", () => {
    expect(getProvider("book")).toBe(googleBooksProvider);
    expect(getProvider("movie")).toBe(tmdbMovieProvider);
    expect(getProvider("tv")).toBe(tmdbTvProvider);
    expect(getProvider("music")).toBe(spotifyProvider);
    expect(getProvider("podcast")).toBe(itunesPodcastProvider);
  });

  it("reports public providers as always available", () => {
    // Google Books and iTunes Podcasts require no API keys
    expect(isProviderAvailable("book")).toBe(true);
    expect(isProviderAvailable("podcast")).toBe(true);
  });

  it("handles empty query strings cleanly across all providers", async () => {
    const types = ["book", "movie", "tv", "music", "podcast"] as const;
    for (const type of types) {
      const provider = getProvider(type);
      const results = await provider.search("   ");
      expect(results).toEqual([]);
    }
  });

  it("searches public media providers and returns normalized results", async () => {
    const bookProvider = getProvider("book");
    const bookResults = await bookProvider.search("dune");
    expect(Array.isArray(bookResults)).toBe(true);
    if (bookResults.length > 0) {
      expect(bookResults[0].title).toBeDefined();
      expect(bookResults[0].externalId).toBeDefined();
      expect(bookResults[0].externalSource).toBeDefined();
    }

    const musicProvider = getProvider("music");
    const musicResults = await musicProvider.search("beatles");
    expect(Array.isArray(musicResults)).toBe(true);
    if (musicResults.length > 0) {
      expect(musicResults[0].title).toBeDefined();
      expect(musicResults[0].creator).toBeDefined();
    }
  });
});


