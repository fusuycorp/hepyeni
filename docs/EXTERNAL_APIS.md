# HepYeni External Media Integrations

This document details the multi-provider external media search architecture, authentication requirements, caching policies, and error-handling strategies in **HepYeni**.

---

## 1. Provider Adapter Pattern

HepYeni standardizes external media integrations using an adapter pattern defined in [`src/lib/providers/types.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/types.ts).

### Normalized Data Contract

```typescript
export type NormalizedSearchResult = {
  externalId: string;
  externalSource: string;
  title: string;
  creator?: string;
  coverUrl?: string;
  metadata?: Record<string, unknown>;
};

export interface MediaProvider {
  mediaType: MediaType;
  search(query: string): Promise<NormalizedSearchResult[]>;
}
```

---

## 2. Provider Implementations

### 2.1 Google Books (`book`)
- **Module**: [`src/lib/providers/google-books.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/google-books.ts)
- **External Source**: `"google-books"`
- **Endpoint**: `https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=12`
- **Authentication**: None (public endpoint).
- **Cover Image Handling**: Google Books thumbnails often return unencrypted `http://` URLs. The adapter normalizes these to `https://` to prevent mixed-content browser warnings.
- **Extracted Metadata**: `description`, `publishedDate`, `pageCount`.

### 2.2 The Movie Database (TMDB) (`movie`, `tv`)
- **Module**: [`src/lib/providers/tmdb.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/tmdb.ts)
- **External Source**: `"tmdb"`
- **Endpoints**:
  - Movies: `https://api.themoviedb.org/3/search/movie?query={query}&include_adult=false`
  - TV Shows: `https://api.themoviedb.org/3/search/tv?query={query}&include_adult=false`
- **Authentication**: Sent via `Authorization: Bearer ${TMDB_API_KEY}` using TMDB's v4 API Read Access Token. This avoids passing sensitive API keys in query parameters that may be logged in proxy or APM traces.
- **Cover Image Handling**: Forms full image URLs using TMDB's `w342` width bucket: `https://image.tmdb.org/t/p/w342${item.poster_path}`.
- **Extracted Metadata**: `overview`, `releaseDate` (`release_date` for movies, `first_air_date` for TV).

### 2.3 Spotify (`music`)
- **Module**: [`src/lib/providers/spotify.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/spotify.ts)
- **External Source**: `"spotify"`
- **Endpoint**: `https://api.spotify.com/v1/search?type=album&limit=12&q={query}`
- **Authentication**: Client-Credentials flow via `https://accounts.spotify.com/api/token`.
- **Token Caching & Request Coalescing**:
  - Resolved tokens are cached in memory until `Date.now() + (expires_in - 60) * 1000`.
  - In-flight requests share a single `pendingToken` Promise to prevent thundering-herd token exhaustion against Spotify API quotas during concurrent searches.
- **Cover Image Handling**: Selects the primary high-resolution album artwork (`images[0].url`).
- **Extracted Metadata**: `releaseDate`.

### 2.4 Apple iTunes Podcasts (`podcast`)
- **Module**: [`src/lib/providers/itunes-podcasts.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/itunes-podcasts.ts)
- **External Source**: `"itunes"`
- **Endpoint**: `https://itunes.apple.com/search?media=podcast&limit=12&term={query}`
- **Authentication**: None (public endpoint).
- **Cover Image Handling**: iTunes returns 100x100 pixel thumbnails (`artworkUrl100`). The adapter dynamically upscales the URL to 600x600 (`replace("100x100", "600x600")`) for sharp cover rendering.
- **Extracted Metadata**: `releaseDate`.

---

## 3. Resilience & Timeout Enforcement

All external API calls enforce strict connection timeouts:

```typescript
const res = await fetch(url, {
  cache: "no-store",
  signal: AbortSignal.timeout(8000), // 8-second circuit breaker
});
```

### Why 8-Second Timeouts Matter:
- Prevents slow upstream third-party APIs from hanging Node/Bun server execution threads.
- Prevents cascading request pileups in the Next.js server connection pool.

---

## 4. Provider Registry & UI Rendering

The provider registry in [`src/lib/providers/index.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/index.ts) exposes:
- [`getProvider(mediaType)`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/index.ts#L16): Resolves the `MediaProvider` instance for a given media category.
- [`isProviderAvailable(mediaType)`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/index.ts#L24): Verifies provider registration before invoking search actions.

### UI Media Presentation
All third-party cover images render through [`MediaCover`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/media-cover.tsx):
- Enforces an `aspect-[2/3]` container with subtle background shimmer.
- Renders fallback icons when `coverUrl` is absent or failed to load.
- Prevents Cumulative Layout Shift (CLS) across heterogeneous third-party image domains.
