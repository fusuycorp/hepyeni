import { describe, expect, it } from "bun:test";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_LABELS_TR, getMediaTypeLabel } from "@/lib/media-types";

describe("Media Types", () => {
  it("contains all expected media types", () => {
    expect(MEDIA_TYPES).toEqual(["book", "movie", "tv", "music", "podcast"]);
  });

  it("provides labels for every supported media type", () => {
    for (const type of MEDIA_TYPES) {
      expect(MEDIA_TYPE_LABELS[type]).toBeDefined();
      expect(typeof MEDIA_TYPE_LABELS[type]).toBe("string");
      expect(MEDIA_TYPE_LABELS[type].length).toBeGreaterThan(0);
      expect(MEDIA_TYPE_LABELS_TR[type]).toBeDefined();
      expect(typeof MEDIA_TYPE_LABELS_TR[type]).toBe("string");
      expect(MEDIA_TYPE_LABELS_TR[type].length).toBeGreaterThan(0);
    }
  });

  it("has correct title casing for labels", () => {
    expect(MEDIA_TYPE_LABELS.book).toBe("Book");
    expect(MEDIA_TYPE_LABELS.movie).toBe("Movie");
    expect(MEDIA_TYPE_LABELS.tv).toBe("TV Show");
    expect(MEDIA_TYPE_LABELS.music).toBe("Music");
    expect(MEDIA_TYPE_LABELS.podcast).toBe("Podcast");
  });

  it("has correct Turkish translations", () => {
    expect(MEDIA_TYPE_LABELS_TR.book).toBe("Kitap");
    expect(MEDIA_TYPE_LABELS_TR.movie).toBe("Film");
    expect(MEDIA_TYPE_LABELS_TR.tv).toBe("Dizi");
    expect(MEDIA_TYPE_LABELS_TR.music).toBe("Müzik");
    expect(MEDIA_TYPE_LABELS_TR.podcast).toBe("Podcast");
    expect(getMediaTypeLabel("book", "tr")).toBe("Kitap");
    expect(getMediaTypeLabel("movie", "en")).toBe("Movie");
  });
});

