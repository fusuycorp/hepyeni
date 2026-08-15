import type { MediaProvider, NormalizedSearchResult } from "./types";

type SpotifyAlbum = {
  id: string;
  name: string;
  artists?: { name: string }[];
  images?: { url: string }[];
  release_date?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
// Caches the in-flight fetch itself (not just the resolved token) so
// concurrent searches arriving before the first token request resolves
// share one request instead of each firing their own against Spotify's
// client-credentials quota.
let pendingToken: Promise<string> | null = null;

async function fetchAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET are not configured");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  if (!pendingToken) {
    pendingToken = fetchAccessToken().finally(() => {
      pendingToken = null;
    });
  }
  return pendingToken;
}

export const spotifyProvider: MediaProvider = {
  mediaType: "music",
  async search(query): Promise<NormalizedSearchResult[]> {
    const token = await getAccessToken();

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "album");
    url.searchParams.set("limit", "12");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Spotify search failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      albums?: { items: SpotifyAlbum[] };
    };

    return (data.albums?.items ?? []).map((album) => ({
      externalId: album.id,
      externalSource: "spotify",
      title: album.name,
      creator: album.artists?.map((a) => a.name).join(", "),
      coverUrl: album.images?.[0]?.url,
      metadata: { releaseDate: album.release_date },
    }));
  },
};
