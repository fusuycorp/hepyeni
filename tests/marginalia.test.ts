import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import {
  validateQuoteInput,
  parseTags,
  formatAttribution,
  canUserViewQuote,
  canUserDeleteQuote,
  filterQuotesForViewer,
  type AddQuoteInput,
} from "@/lib/actions/marginalia";

describe("Phase 3: Digital Marginalia & Quote Snaps", () => {
  describe("Input Boundaries & Content Validation", () => {
    it("accepts valid quote input with 1 character", () => {
      const input: AddQuoteInput = {
        titleName: "Dune",
        quoteText: "A",
      };
      const result = validateQuoteInput(input);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.quoteText).toBe("A");
      expect(result.sanitized?.titleName).toBe("Dune");
    });

    it("accepts maximum allowed quote length of 3000 characters", () => {
      const longQuote = "Q".repeat(3000);
      const input: AddQuoteInput = {
        titleName: "War and Peace",
        quoteText: longQuote,
      };
      const result = validateQuoteInput(input);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.quoteText.length).toBe(3000);
    });

    it("rejects empty quote text or whitespace-only", () => {
      expect(validateQuoteInput({ titleName: "Dune", quoteText: "" }).valid).toBe(false);
      expect(validateQuoteInput({ titleName: "Dune", quoteText: "   \n\t  " }).valid).toBe(false);
      expect(validateQuoteInput({ titleName: "Dune", quoteText: (null as unknown as string) }).valid).toBe(false);
    });

    it("rejects quote text exceeding 3000 characters", () => {
      const excessiveQuote = "Q".repeat(3001);
      const result = validateQuoteInput({
        titleName: "Dune",
        quoteText: excessiveQuote,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("3000");
    });

    it("rejects empty or whitespace-only titleName", () => {
      expect(validateQuoteInput({ titleName: "", quoteText: "Valid quote" }).valid).toBe(false);
      expect(validateQuoteInput({ titleName: "   ", quoteText: "Valid quote" }).valid).toBe(false);
    });

    it("rejects titleName exceeding 200 characters", () => {
      const longTitle = "T".repeat(201);
      const result = validateQuoteInput({
        titleName: longTitle,
        quoteText: "Valid quote",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("200");
    });

    it("rejects attribution exceeding 200 characters", () => {
      const longAttribution = "A".repeat(201);
      const result = validateQuoteInput({
        titleName: "Dune",
        quoteText: "Fear is the mind-killer.",
        attribution: longAttribution,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("200");
    });

    it("trims whitespace and preserves unicode, Turkish chars, and emojis", () => {
      const input: AddQuoteInput = {
        titleName: "  Kürk Mantolu Madonna  ",
        quoteText: "  \"Dünyada bana hiçbir şey, tabiat kadar merhametsiz gelmemiştir.\" ✨  ",
        attribution: "  Sabahattin Ali, Sayfa 48  ",
        mediaType: "book",
      };
      const result = validateQuoteInput(input);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.titleName).toBe("Kürk Mantolu Madonna");
      expect(result.sanitized?.quoteText).toBe("\"Dünyada bana hiçbir şey, tabiat kadar merhametsiz gelmemiştir.\" ✨");
      expect(result.sanitized?.attribution).toBe("Sabahattin Ali, Sayfa 48");
      expect(result.sanitized?.mediaType).toBe("book");
    });
  });

  describe("Tag Parsing & Sanitization", () => {
    it("parses comma-separated tag string correctly", () => {
      const raw = "philosophy, sci-fi, favorite, memory";
      expect(parseTags(raw)).toEqual(["philosophy", "sci-fi", "favorite", "memory"]);
    });

    it("parses hashtag-prefixed string and strips hashes", () => {
      const raw = "#stoicism #wisdom #marcus_aurelius";
      expect(parseTags(raw)).toEqual(["stoicism", "wisdom", "marcus_aurelius"]);
    });

    it("handles mixed arrays and strings with whitespace and case deduplication", () => {
      const raw = ["  #Sci-Fi  ", "philosophy", "sci-fi", "PHILOSOPHY", "classic"];
      expect(parseTags(raw)).toEqual(["sci-fi", "philosophy", "classic"]);
    });

    it("handles empty strings, undefined, null, and empty arrays safely", () => {
      expect(parseTags("")).toEqual([]);
      expect(parseTags("   , ,  , ")).toEqual([]);
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
      expect(parseTags([])).toEqual([]);
    });

    it("truncates individual tags exceeding 50 characters", () => {
      const ultraLongTag = "t".repeat(60);
      const parsed = parseTags(ultraLongTag);
      expect(parsed.length).toBe(1);
      expect(parsed[0].length).toBe(50);
    });
  });

  describe("Attribution Formatting", () => {
    it("formats simple string attribution directly", () => {
      expect(formatAttribution("Chapter 3, p. 45")).toBe("Chapter 3, p. 45");
      expect(formatAttribution("   Frank Herbert   ")).toBe("Frank Herbert");
    });

    it("formats structured object attribution with author, work, chapter, page", () => {
      const formatted = formatAttribution({
        author: "Frank Herbert",
        work: "Dune",
        chapter: "Chapter 1",
        page: "p. 42",
      });
      expect(formatted).toBe("Frank Herbert, Dune, Chapter 1 (p. 42)");
    });

    it("formats structured attribution with audio/video timestamp", () => {
      const formatted = formatAttribution({
        author: "Denis Villeneuve",
        work: "Dune: Part Two",
        timestamp: "01:45:20",
      });
      expect(formatted).toBe("Denis Villeneuve, Dune: Part Two [01:45:20]");
    });

    it("handles partial structured attribution gracefully", () => {
      expect(formatAttribution({ page: "p. 100" })).toBe("(p. 100)");
      expect(formatAttribution({ chapter: "Act II, Scene 1" })).toBe("Act II, Scene 1");
      expect(formatAttribution({})).toBe("");
    });
  });

  describe("Privacy Scoping & Circle Access Matrix", () => {
    const quoteAuthorId = "user-alice";
    const circleMemberId = "user-bob";
    const outsiderUserId = "user-stranger";

    const privateQuote = {
      id: "quote-1",
      user: quoteAuthorId,
      titleName: "Private Thoughts",
      quoteText: "A secret passage.",
      isSharedWithCircles: [] as string[],
    };

    const circleQuote = {
      id: "quote-2",
      user: quoteAuthorId,
      titleName: "Circle Book Club",
      quoteText: "Shared with sci-fi circle.",
      isSharedWithCircles: ["circle-scifi", "circle-bookclub"],
    };

    it("allows author to view their own quote regardless of circle sharing", () => {
      expect(canUserViewQuote(privateQuote, quoteAuthorId, [])).toBe(true);
      expect(canUserViewQuote(circleQuote, quoteAuthorId, [])).toBe(true);
    });

    it("denies other users from viewing private quotes", () => {
      expect(canUserViewQuote(privateQuote, circleMemberId, ["circle-scifi"])).toBe(false);
      expect(canUserViewQuote(privateQuote, outsiderUserId, [])).toBe(false);
    });

    it("allows circle members to view quotes shared with their circle", () => {
      expect(canUserViewQuote(circleQuote, circleMemberId, ["circle-scifi"])).toBe(true);
      expect(canUserViewQuote(circleQuote, circleMemberId, ["circle-bookclub"])).toBe(true);
    });

    it("denies non-members from viewing circle-shared quotes", () => {
      expect(canUserViewQuote(circleQuote, outsiderUserId, ["circle-general"])).toBe(false);
      expect(canUserViewQuote(circleQuote, outsiderUserId, [])).toBe(false);
    });

    it("filters a list of quotes accurately for a given viewer", () => {
      const allQuotes = [privateQuote, circleQuote];

      // Alice (author) sees both
      const aliceView = filterQuotesForViewer(allQuotes, quoteAuthorId, []);
      expect(aliceView.length).toBe(2);

      // Bob (member of circle-scifi) sees only circleQuote
      const bobView = filterQuotesForViewer(allQuotes, circleMemberId, ["circle-scifi"]);
      expect(bobView.length).toBe(1);
      expect(bobView[0].id).toBe("quote-2");

      // Stranger sees nothing
      const strangerView = filterQuotesForViewer(allQuotes, outsiderUserId, []);
      expect(strangerView.length).toBe(0);
    });
  });

  describe("Author Deletion Rights", () => {
    const quote = {
      id: "quote-1",
      user: "user-alice",
      titleName: "Dune",
      quoteText: "Fear is the mind-killer.",
    };

    it("allows the quote author to delete their quote", () => {
      expect(canUserDeleteQuote(quote, { id: "user-alice" })).toBe(true);
    });

    it("denies other non-admin users from deleting the quote", () => {
      expect(canUserDeleteQuote(quote, { id: "user-bob" })).toBe(false);
    });

    it("allows system administrators to delete any quote", () => {
      expect(canUserDeleteQuote(quote, { id: "user-admin", isAdmin: true })).toBe(true);
    });

    it("denies unauthenticated users from deleting quotes", () => {
      expect(canUserDeleteQuote(quote, null)).toBe(false);
      expect(canUserDeleteQuote(quote, { id: "" })).toBe(false);
    });
  });

  describe("100% Translation Key Parity for Digital Marginalia", () => {
    const requiredMarginaliaKeys = [
      "tabTitle",
      "captureQuote",
      "dialogTitle",
      "dialogSubtitle",
      "quoteTextLabel",
      "quotePlaceholder",
      "titleLabel",
      "titlePlaceholder",
      "attributionLabel",
      "attributionPlaceholder",
      "tagsLabel",
      "tagsPlaceholder",
      "linkToShelfItem",
      "noLinkedMedia",
      "shareWithCircles",
      "shareWithCirclesDesc",
      "emptyQuotes",
      "filterByTag",
      "filterByMedia",
      "allTags",
      "allMedia",
      "copyQuote",
      "copySuccess",
      "deleteQuote",
      "deleteConfirm",
      "quoteDeleted",
      "quoteSaved",
      "characterCount",
    ];

    it("has all required marginalia translation keys in English and Turkish", () => {
      expect("marginalia" in en).toBe(true);
      expect("marginalia" in tr).toBe(true);

      for (const key of requiredMarginaliaKeys) {
        expect(key in en.marginalia).toBe(true);
        expect(key in tr.marginalia).toBe(true);

        const valEn = (en.marginalia as Record<string, string>)[key];
        const valTr = (tr.marginalia as Record<string, string>)[key];

        expect(typeof valEn).toBe("string");
        expect(typeof valTr).toBe("string");
        expect(valEn.trim().length).toBeGreaterThan(0);
        expect(valTr.trim().length).toBeGreaterThan(0);
      }
    });

    it("matches interpolation placeholders between EN and TR", () => {
      for (const key of requiredMarginaliaKeys) {
        const valEn = (en.marginalia as Record<string, string>)[key];
        const valTr = (tr.marginalia as Record<string, string>)[key];

        const placeholdersEn = (valEn.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
        const placeholdersTr = (valTr.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

        expect(placeholdersEn).toEqual(placeholdersTr);
      }
    });
  });
});
