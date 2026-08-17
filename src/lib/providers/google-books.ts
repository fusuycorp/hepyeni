import { AppError, logDiagnostic } from "@/lib/errors";
import type { MediaProvider, NormalizedSearchResult } from "./types";

type GoogleBooksItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
};

async function searchOpenLibrary(query: string): Promise<NormalizedSearchResult[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "12");

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Titirek/1.0 (https://hepyeni.net; contact@titirek.app)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`OpenLibrary search failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };


  return (data.docs ?? []).map((doc) => ({
    externalId: doc.key.replace("/works/", ""),
    externalSource: "open-library",
    title: doc.title || "Untitled",
    creator: doc.author_name?.slice(0, 3).join(", "),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
    metadata: {
      publishedDate: doc.first_publish_year
        ? String(doc.first_publish_year)
        : undefined,
      pageCount: doc.number_of_pages_median,
    },
  }));
}

export const googleBooksProvider: MediaProvider = {
  mediaType: "book",
  async search(query): Promise<NormalizedSearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const apiKey =
      process.env.GOOGLE_BOOKS_API_KEY || process.env.GOOGLE_API_KEY;

    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("maxResults", "12");
    if (apiKey) {
      url.searchParams.set("key", apiKey);
    }

    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "Titirek/1.0 (https://hepyeni.net)",
        },
        signal: AbortSignal.timeout(8000),
      });


      if (!res.ok) {
        throw new Error(`Google Books API HTTP ${res.status}`);
      }

      const data = (await res.json()) as { items?: GoogleBooksItem[] };

      return (data.items ?? []).map((item) => ({
        externalId: item.id,
        externalSource: "google-books",
        title: item.volumeInfo?.title ?? "Untitled",
        creator: item.volumeInfo?.authors?.join(", "),
        coverUrl: (
          item.volumeInfo?.imageLinks?.thumbnail ||
          item.volumeInfo?.imageLinks?.smallThumbnail
        )?.replace("http://", "https://"),
        metadata: {
          description: item.volumeInfo?.description,
          publishedDate: item.volumeInfo?.publishedDate,
          pageCount: item.volumeInfo?.pageCount,
        },
      }));
    } catch (googleErr) {
      // Primary provider failed (rate limit, quota, timeout, network error).
      // Attempt resilient fallback via OpenLibrary.
      logDiagnostic(googleErr, {
        action: "searchTitles:google-books",
        query: cleanQuery,
        note: "Attempting Open Library fallback",
      });

      try {
        const fallbackResults = await searchOpenLibrary(cleanQuery);
        if (fallbackResults.length > 0) {
          return fallbackResults;
        }
      } catch (openLibErr) {
        logDiagnostic(openLibErr, {
          action: "searchTitles:open-library-fallback",
          query: cleanQuery,
        });
      }

      // If both providers failed or returned empty on error, throw structured AppError
      throw new AppError("Book search service is temporarily unavailable.", {
        code: "BOOK_SEARCH_FAILED",
        technicalDetails: {
          query: cleanQuery,
          googleError:
            googleErr instanceof Error ? googleErr.message : String(googleErr),
        },
        cause: googleErr,
      });
    }
  },
};
