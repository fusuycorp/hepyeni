import { describe, expect, it } from "bun:test";
import { MEDIA_TYPES } from "@/lib/media-types";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Media Types", () => {
  it("contains all expected media types", () => {
    expect(MEDIA_TYPES).toEqual(["book", "movie", "tv", "music", "podcast"]);
  });

  it("provides an en/tr translation label for every supported media type", () => {
    for (const type of MEDIA_TYPES) {
      expect(en.media[type]).toBeDefined();
      expect(typeof en.media[type]).toBe("string");
      expect(en.media[type].length).toBeGreaterThan(0);
      expect(tr.media[type]).toBeDefined();
      expect(typeof tr.media[type]).toBe("string");
      expect(tr.media[type].length).toBeGreaterThan(0);
    }
  });

  it("has correct title casing for English labels", () => {
    expect(en.media.book).toBe("Book");
    expect(en.media.movie).toBe("Movie");
    expect(en.media.tv).toBe("TV Show");
    expect(en.media.music).toBe("Music");
    expect(en.media.podcast).toBe("Podcast");
  });

  it("has correct Turkish translations", () => {
    expect(tr.media.book).toBe("Kitap");
    expect(tr.media.movie).toBe("Film");
    expect(tr.media.tv).toBe("Dizi");
    expect(tr.media.music).toBe("Müzik");
    expect(tr.media.podcast).toBe("Podcast");
  });
});

