import { describe, expect, it } from "bun:test";
import { getProvider, isProviderAvailable } from "@/lib/providers";
import { googleBooksProvider } from "@/lib/providers/google-books";
import { itunesPodcastProvider } from "@/lib/providers/itunes-podcasts";
import { tmdbMovieProvider, tmdbTvProvider } from "@/lib/providers/tmdb";
import { spotifyProvider } from "@/lib/providers/spotify";
import { getRecentDiagnostics } from "@/lib/errors";

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

// ---------------------------------------------------------------------------
// S2 redaction (F-4): provider fallback diagnostics must log query length only,
// never the raw user search query. All fetches are mocked to fail so every
// catch branch runs against a deterministic network error.
// ---------------------------------------------------------------------------

function mockFetchToFail() {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down (mocked)");
  }) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function findDiagnostic(action: string) {
  return getRecentDiagnostics().find((e) => e.action === action);
}

describe("Provider query redaction (S2 / F-4)", () => {
  it("logs queryLength only for every Google Books fallback tier", async () => {
    const restore = mockFetchToFail();
    const secret = "S3Cret-gBook-qUery-77aa";
    try {
      const results = await googleBooksProvider.search(secret);
      expect(results).toEqual([]);
    } finally {
      restore();
    }

    const recent = getRecentDiagnostics();
    for (const action of [
      "searchTitles:google-books",
      "searchTitles:itunes-ebook-fallback",
      "searchTitles:open-library-fallback",
    ]) {
      const entry = findDiagnostic(action);
      expect(entry, action).toBeDefined();
      expect(entry?.technicalDetails?.queryLength).toBe(secret.length);
      expect(entry?.technicalDetails).not.toHaveProperty("query");
    }
    expect(JSON.stringify(recent)).not.toContain(secret);
  });

  it("logs queryLength only for the Spotify search fallback", async () => {
    const oldClientId = process.env.SPOTIFY_CLIENT_ID;
    const oldClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    const restore = mockFetchToFail();
    const secret = "pr!v@te-spotify-q1";
    try {
      await spotifyProvider.search(secret).catch(() => []);
    } finally {
      restore();
      if (oldClientId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
      else process.env.SPOTIFY_CLIENT_ID = oldClientId;
      if (oldClientSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
      else process.env.SPOTIFY_CLIENT_SECRET = oldClientSecret;
    }

    const recent = getRecentDiagnostics();
    const entry = findDiagnostic("spotify:search");
    expect(entry, "spotify:search").toBeDefined();
    expect(entry?.technicalDetails?.queryLength).toBe(secret.length);
    expect(entry?.technicalDetails).not.toHaveProperty("query");
    expect(JSON.stringify(recent)).not.toContain(secret);
  });

  it("logs queryLength only for TMDB search failures", async () => {
    const oldKey = process.env.TMDB_API_KEY;
    process.env.TMDB_API_KEY = "test-tmdb-key";
    const restore = mockFetchToFail();
    const secret = "MOVIE-S3cret-Q";
    try {
      await tmdbMovieProvider.search(secret).catch(() => []);
    } finally {
      restore();
      if (oldKey === undefined) delete process.env.TMDB_API_KEY;
      else process.env.TMDB_API_KEY = oldKey;
    }

    const recent = getRecentDiagnostics();
    const entry = findDiagnostic("tmdb:movie:search");
    expect(entry, "tmdb:movie:search").toBeDefined();
    expect(entry?.technicalDetails?.queryLength).toBe(secret.length);
    expect(entry?.technicalDetails).not.toHaveProperty("query");
    expect(JSON.stringify(recent)).not.toContain(secret);
  });
});


