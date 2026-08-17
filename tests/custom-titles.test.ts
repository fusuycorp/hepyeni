import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Custom Media Recommendations & Translations", () => {
  it("enforces full translation parity for custom media keys", () => {
    const customKeys = [
      "addCustomTitle",
      "cantFindMedia",
      "cantFindMediaDesc",
      "customTitleName",
      "customTitlePlaceholder",
      "customCreatorLabel",
      "authorLabel",
      "directorLabel",
      "artistLabel",
      "hostLabel",
      "coverUrlLabel",
      "coverUrlPlaceholder",
      "descriptionLabel",
      "descriptionPlaceholder",
      "addCustomButton",
      "addingCustom",
      "backToSearch",
      "previewCover",
    ] as const;

    for (const key of customKeys) {
      expect(en.titles[key]).toBeDefined();
      expect(en.titles[key].length).toBeGreaterThan(0);
      expect(tr.titles[key]).toBeDefined();
      expect(tr.titles[key].length).toBeGreaterThan(0);
    }
  });

  it("validates dynamic creator role labels for each media type", () => {
    const getRoleLabel = (type: string, lang: "en" | "tr") => {
      const dict = lang === "en" ? en : tr;
      switch (type) {
        case "book":
          return dict.titles.authorLabel;
        case "movie":
        case "tv":
          return dict.titles.directorLabel;
        case "music":
          return dict.titles.artistLabel;
        case "podcast":
          return dict.titles.hostLabel;
        default:
          return dict.titles.customCreatorLabel;
      }
    };

    expect(getRoleLabel("book", "en")).toBe("Author");
    expect(getRoleLabel("book", "tr")).toBe("Yazar");
    expect(getRoleLabel("movie", "en")).toBe("Director / Creator");
    expect(getRoleLabel("movie", "tr")).toBe("Yönetmen / Yapımcı");
    expect(getRoleLabel("music", "en")).toBe("Artist / Band");
    expect(getRoleLabel("music", "tr")).toBe("Sanatçı / Grup");
    expect(getRoleLabel("podcast", "en")).toBe("Host / Channel");
    expect(getRoleLabel("podcast", "tr")).toBe("Sunucu / Kanal");
  });
});
