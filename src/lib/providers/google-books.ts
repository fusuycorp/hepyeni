import type { MediaProvider, NormalizedSearchResult } from "./types";

type GoogleBooksItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string };
  };
};

export const googleBooksProvider: MediaProvider = {
  mediaType: "book",
  async search(query): Promise<NormalizedSearchResult[]> {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "12");

    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Google Books search failed: ${res.status}`);
    }

    const data = (await res.json()) as { items?: GoogleBooksItem[] };

    return (data.items ?? []).map((item) => ({
      externalId: item.id,
      externalSource: "google-books",
      title: item.volumeInfo?.title ?? "Untitled",
      creator: item.volumeInfo?.authors?.join(", "),
      coverUrl: item.volumeInfo?.imageLinks?.thumbnail?.replace(
        "http://",
        "https://",
      ),
      metadata: {
        description: item.volumeInfo?.description,
        publishedDate: item.volumeInfo?.publishedDate,
        pageCount: item.volumeInfo?.pageCount,
      },
    }));
  },
};
