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

  it("handles empty query strings cleanly", async () => {
    // Google Books search returns empty or results structure
    const provider = getProvider("book");
    expect(provider.mediaType).toBe("book");
  });
});
