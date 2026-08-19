import { describe, expect, it } from "bun:test";
import {
  findCanonicalProviderMatch,
  normalizeProviderResult,
} from "@/lib/providers/validation";

describe("provider result validation", () => {
  it("normalizes only complete provider records", () => {
    expect(
      normalizeProviderResult("book", {
        externalSource: " Google-Books ",
        externalId: " 123 ",
        title: "  Dune  ",
        creator: " Frank Herbert ",
        coverUrl: "https://covers.example/dune.jpg",
        metadata: { pageCount: 412 },
      }),
    ).toEqual({
      externalSource: "google-books",
      externalId: "123",
      title: "Dune",
      creator: "Frank Herbert",
      coverUrl: "https://covers.example/dune.jpg",
      metadata: { pageCount: 412 },
    });
    expect(normalizeProviderResult("book", { externalId: "1", title: "Missing source" })).toBeNull();
  });

  it("returns the canonical server result only when source, id, and title match", () => {
    const canonical = {
      externalSource: "tmdb",
      externalId: "42",
      title: "The Film",
      creator: "Director",
    };

    expect(
      findCanonicalProviderMatch("movie", { ...canonical, creator: "Forged" }, [canonical]),
    ).toEqual(canonical);
    expect(
      findCanonicalProviderMatch("movie", { ...canonical, externalId: "999" }, [canonical]),
    ).toBeNull();
    expect(
      findCanonicalProviderMatch("movie", { ...canonical, title: "Different Film" }, [canonical]),
    ).toBeNull();
  });
});
