import { describe, expect, it } from "bun:test";
import { validateCommentContent } from "@/lib/comments";
import {
  formatAttribution,
  parseTags,
  validateQuoteInput,
  type AddQuoteInput,
} from "@/lib/marginalia";
import {
  MOODS,
  PACES,
  normalizeMoods,
  normalizePace,
} from "@/lib/moods";
import { getDisplayName, getInitials } from "@/lib/format";
import { toIsoDate } from "@/lib/date";
import { voteRecordId } from "@/lib/pocketbase/vote-id";

describe("Adversarial Fuzzing: Input Validators & Sanitizers", () => {
  // Shared adversarial attack vectors
  const sqlInjectionVectors = [
    "' OR '1'='1",
    "'; DROP TABLE titles; --",
    "admin' --",
    "' UNION SELECT null, username, password FROM users --",
    "1; EXEC xp_cmdshell('dir'); --",
    "\" OR \"\"=\"",
    "' OR 1=1 #",
    "'; SHUTDOWN; --",
  ];

  const xssVectors = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:void(0)",
    "<svg/onload=alert(document.cookie)>",
    "\"><script>alert(1)</script>",
    "<iframe src=\"javascript:alert(1)\"></iframe>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "<a href=\"javascript:alert('click')\">click me</a>",
    "<!--<script>alert(1)</script>-->",
  ];

  const protoPollutionKeys = [
    "__proto__",
    "constructor",
    "prototype",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
  ];

  const unicodeChaosVectors = [
    "\u202Ereversed_text\u202C", // Right-to-left override
    "zero\u200Bwidth\u200Cspace\u200Dtest", // Zero-width spaces & joiners
    "\uD83D\uDE00\uD83D\uDE04\uD83D\uDE0A", // Surrogate pair emojis
    "👨‍👩‍👧‍👦", // Complex compound emoji
    "👍🏿👍🏾👍🏽👍🏼👍🏻", // Skin tone modifiers
    "Ť̷̮́ḯ̸̳t̷̩̊i̴̮͑r̶͖̚ḛ̸̒ḱ̶͖ Z̸̎͋a̷͌̆l̸̈́̋g̷͊͝o̴", // Zalgo text
    "Türkçe karakterler: ğüşıöç ĞÜŞİÖÇ İı Ii", // Turkish special chars
    "日本語テキストと絵文字 🌸 (Japanese)", // CJK
    "اللغة العربية الجميلة (Arabic RTL)", // Arabic
    "Русский текст и кириллица (Cyrillic)", // Cyrillic
    "\x00\x01\x02\x1f\x7f", // ASCII control chars & null byte
    "   \t\r\n\v\f   ", // Whitespace chaos
  ];

  const extremeLengths = {
    empty: "",
    single: "A",
    exact200: "A".repeat(200),
    exact201: "A".repeat(201),
    exact2000: "B".repeat(2000),
    exact2001: "B".repeat(2001),
    exact3000: "C".repeat(3000),
    exact3001: "C".repeat(3001),
    len10k: "D".repeat(10000),
    len100k: "E".repeat(100000),
  };

  // ==========================================
  // 1. validateCommentContent
  // ==========================================
  describe("validateCommentContent", () => {
    it("safely preserves SQL injection strings without executing or crashing", () => {
      for (const vector of sqlInjectionVectors) {
        const result = validateCommentContent(vector);
        expect(result).toBe(vector.trim());
      }
    });

    it("safely preserves XSS attack vectors as raw strings without crashing", () => {
      for (const vector of xssVectors) {
        const result = validateCommentContent(vector);
        expect(result).toBe(vector.trim());
      }
    });

    it("handles prototype pollution strings without polluting object prototype", () => {
      for (const key of protoPollutionKeys) {
        const result = validateCommentContent(key);
        expect(result).toBe(key);
        expect((Object.prototype as Record<string, unknown>)["polluted_fuzz_marker"]).toBeUndefined();
      }
    });

    it("handles unicode chaos, zalgo, RTL, surrogate pairs, and Turkish characters cleanly", () => {
      for (const vector of unicodeChaosVectors) {
        if (vector.trim().length === 0) {
          expect(() => validateCommentContent(vector)).toThrow("Comment content cannot be empty");
        } else {
          const result = validateCommentContent(vector);
          expect(result).toBe(vector.trim());
        }
      }
    });

    it("enforces exact character boundary limits (1 to 2000 chars)", () => {
      expect(validateCommentContent(extremeLengths.single)).toBe("A");
      expect(validateCommentContent(extremeLengths.exact200)).toBe(extremeLengths.exact200);
      expect(validateCommentContent(extremeLengths.exact2000)).toBe(extremeLengths.exact2000);

      expect(() => validateCommentContent(extremeLengths.empty)).toThrow("Comment content cannot be empty");
      expect(() => validateCommentContent(extremeLengths.exact2001)).toThrow("Comment content cannot exceed 2000 characters");
      expect(() => validateCommentContent(extremeLengths.len10k)).toThrow("Comment content cannot exceed 2000 characters");
      expect(() => validateCommentContent(extremeLengths.len100k)).toThrow("Comment content cannot exceed 2000 characters");
    });

    it("handles type confusion gracefully (null, undefined, primitives, objects with custom toString)", () => {
      expect(() => validateCommentContent(null)).toThrow("Comment content cannot be empty");
      expect(() => validateCommentContent(undefined)).toThrow("Comment content cannot be empty");
      expect(() => validateCommentContent("")).toThrow("Comment content cannot be empty");
      expect(() => validateCommentContent("     \n\t  ")).toThrow("Comment content cannot be empty");

      // Number conversion
      expect(validateCommentContent(12345)).toBe("12345");
      expect(validateCommentContent(0)).toBe("0");
      expect(validateCommentContent(false)).toBe("false");
      expect(validateCommentContent(NaN)).toBe("NaN");
      expect(validateCommentContent(Infinity)).toBe("Infinity");
      expect(validateCommentContent(-Infinity)).toBe("-Infinity");

      // Null prototype object & custom toString
      const nullProto = Object.create(null);
      expect(() => validateCommentContent(nullProto)).toThrow("Comment content cannot be empty");

      const throwingObj = {
        toString() {
          throw new Error("toString exploded");
        },
      };
      expect(() => validateCommentContent(throwingObj)).toThrow("Comment content cannot be empty");

      const customObj = {
        toString() {
          return "  Custom Object String  ";
        },
      };
      expect(validateCommentContent(customObj)).toBe("Custom Object String");
    });
  });

  // ==========================================
  // 2. validateQuoteInput
  // ==========================================
  describe("validateQuoteInput", () => {
    it("accepts valid quote with SQL injection, XSS, proto keys, and unicode", () => {
      for (const sqli of sqlInjectionVectors) {
        const res = validateQuoteInput({ quoteText: sqli, titleName: "Dune" });
        expect(res.valid).toBe(true);
        expect(res.sanitized?.quoteText).toBe(sqli.trim());
      }

      for (const xss of xssVectors) {
        const res = validateQuoteInput({ quoteText: xss, titleName: "Matrix" });
        expect(res.valid).toBe(true);
        expect(res.sanitized?.quoteText).toBe(xss.trim());
      }

      for (const key of protoPollutionKeys) {
        const res = validateQuoteInput({ quoteText: "Valid quote", titleName: key, attribution: key });
        expect(res.valid).toBe(true);
        expect(res.sanitized?.titleName).toBe(key);
        expect(res.sanitized?.attribution).toBe(key);
      }
    });

    it("enforces exact length boundaries on quoteText (1..3000), titleName (1..200), attribution (0..200)", () => {
      // quoteText bounds
      expect(validateQuoteInput({ quoteText: extremeLengths.single, titleName: "Title" }).valid).toBe(true);
      expect(validateQuoteInput({ quoteText: extremeLengths.exact3000, titleName: "Title" }).valid).toBe(true);
      expect(validateQuoteInput({ quoteText: extremeLengths.exact3001, titleName: "Title" }).valid).toBe(false);
      expect(validateQuoteInput({ quoteText: extremeLengths.exact3001, titleName: "Title" }).error).toContain("3000");
      expect(validateQuoteInput({ quoteText: extremeLengths.len10k, titleName: "Title" }).valid).toBe(false);

      // titleName bounds
      expect(validateQuoteInput({ quoteText: "Quote", titleName: extremeLengths.single }).valid).toBe(true);
      expect(validateQuoteInput({ quoteText: "Quote", titleName: extremeLengths.exact200 }).valid).toBe(true);
      expect(validateQuoteInput({ quoteText: "Quote", titleName: extremeLengths.exact201 }).valid).toBe(false);
      expect(validateQuoteInput({ quoteText: "Quote", titleName: extremeLengths.exact201 }).error).toContain("200");
      expect(validateQuoteInput({ quoteText: "Quote", titleName: extremeLengths.len10k }).valid).toBe(false);

      // attribution bounds
      expect(validateQuoteInput({ quoteText: "Quote", titleName: "Title", attribution: extremeLengths.exact200 }).valid).toBe(true);
      expect(validateQuoteInput({ quoteText: "Quote", titleName: "Title", attribution: extremeLengths.exact201 }).valid).toBe(false);
      expect(validateQuoteInput({ quoteText: "Quote", titleName: "Title", attribution: extremeLengths.exact201 }).error).toContain("200");
    });

    it("handles type confusion on input root and properties without throwing", () => {
      expect(validateQuoteInput(null as unknown as AddQuoteInput).valid).toBe(false);
      expect(validateQuoteInput(undefined as unknown as AddQuoteInput).valid).toBe(false);
      expect(validateQuoteInput("not an object" as unknown as AddQuoteInput).valid).toBe(false);
      expect(validateQuoteInput(12345 as unknown as AddQuoteInput).valid).toBe(false);
      expect(validateQuoteInput([] as unknown as AddQuoteInput).valid).toBe(false);

      // Properties with invalid types
      const badProps = validateQuoteInput({
        quoteText: (12345 as unknown as string),
        titleName: (["Array Title"] as unknown as string),
        attribution: (true as unknown as string),
        mediaType: ({} as unknown as string),
        progressItem: (null as unknown as string),
        tags: (123 as unknown as string[]),
        isSharedWithCircles: (["", "   ", "valid_circle_1", null as unknown as string]),
      });

      expect(badProps.valid).toBe(false);
      expect(badProps.error).toBeDefined();

      // Valid quote with corrupted circle sharing array
      const validQuoteBadCircles = validateQuoteInput({
        quoteText: "Valid quote text",
        titleName: "Valid title",
        isSharedWithCircles: ["c1", "", "   ", (123 as unknown as string), "c2"],
      });
      expect(validQuoteBadCircles.valid).toBe(true);
      expect(validQuoteBadCircles.sanitized?.isSharedWithCircles).toEqual(["c1", "c2"]);
    });
  });

  // ==========================================
  // 3. parseTags
  // ==========================================
  describe("parseTags", () => {
    it("handles SQLi, XSS, prototype pollution keys without prototype leakage", () => {
      const tags = parseTags([...protoPollutionKeys, ...sqlInjectionVectors.slice(0, 3)]);
      expect(tags).toContain("__proto__");
      expect(tags).toContain("constructor");
      expect(tags).toContain("prototype");
      expect(tags.length).toBeGreaterThan(0);
      expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
    });

    it("parses comma-separated, space-separated, hash-prefixed, and mixed strings", () => {
      expect(parseTags("#philosophy, #sci-fi, #dune")).toEqual(["philosophy", "sci-fi", "dune"]);
      expect(parseTags("philosophy sci-fi   dune")).toEqual(["philosophy", "sci-fi", "dune"]);
      expect(parseTags("#tag1 #tag2 #TAG1")).toEqual(["tag1", "tag2"]); // Deduplication + lowercasing
    });

    it("truncates individual tags longer than 50 characters", () => {
      const longTag = "x".repeat(100);
      const parsed = parseTags(longTag);
      expect(parsed).toEqual(["x".repeat(50)]);
    });

    it("handles unicode chaos, emojis, zalgo, and Turkish characters in tags", () => {
      const tags = parseTags(["#felsefe", "TÜRKÇE", "👨‍👩‍👧‍👦", "Z̸̎͋a̷͌̆l̸̈́̋g̷͊͝o̴", "İNCİR"]);
      expect(tags).toContain("felsefe");
      expect(tags).toContain("türkçe");
      expect(tags).toContain("👨‍👩‍👧‍👦");
      expect(tags).toContain("i̇nci̇r"); // Lowercased Turkish I
    });

    it("gracefully returns empty array for null, undefined, numbers, booleans, empty strings, arrays with non-strings", () => {
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
      expect(parseTags("")).toEqual([]);
      expect(parseTags("   , ,   , ")).toEqual([]);
      expect(parseTags(12345 as unknown as string)).toEqual([]);
      expect(parseTags(true as unknown as string)).toEqual([]);
      expect(parseTags({} as unknown as string)).toEqual([]);
      expect(parseTags([null, undefined, 123, true, {}] as unknown as string[])).toEqual([]);
    });
  });

  // ==========================================
  // 4. formatAttribution
  // ==========================================
  describe("formatAttribution", () => {
    it("handles string attribution safely with whitespace trimming", () => {
      expect(formatAttribution("   Frank Herbert, Chapter 1   ")).toBe("Frank Herbert, Chapter 1");
      expect(formatAttribution("")).toBe("");
      expect(formatAttribution(null)).toBe("");
      expect(formatAttribution(undefined)).toBe("");
    });

    it("formats structured attribution options correctly", () => {
      expect(
        formatAttribution({
          author: "Frank Herbert",
          work: "Dune",
          chapter: "Chapter 4",
          page: 42,
          timestamp: "01:23:45",
        }),
      ).toBe("Frank Herbert, Dune, Chapter 4 (p. 42) [01:23:45]");
    });

    it("handles existing page prefixes ('p.', 's.', 'page') without double prefixing", () => {
      expect(formatAttribution({ page: "p. 100" })).toBe("(p. 100)");
      expect(formatAttribution({ page: "s. 55" })).toBe("(s. 55)");
      expect(formatAttribution({ page: "page 99" })).toBe("(page 99)");
      expect(formatAttribution({ page: "100" })).toBe("(p. 100)");
    });

    it("handles type confusion on StructuredAttribution fields without crashing", () => {
      expect(formatAttribution(12345 as unknown as string)).toBe("");
      expect(formatAttribution(true as unknown as string)).toBe("");
      expect(formatAttribution([] as unknown as string)).toBe("");

      const corruptObj = {
        author: (123 as unknown as string),
        work: (null as unknown as string),
        chapter: (true as unknown as string),
        page: (undefined as unknown as string),
        timestamp: ([] as unknown as string),
      };
      expect(formatAttribution(corruptObj)).toBe("");
    });
  });

  // ==========================================
  // 5. normalizeMoods & normalizePace
  // ==========================================
  describe("normalizeMoods & normalizePace", () => {
    it("extracts all valid moods and deduplicates", () => {
      expect(normalizeMoods([...MOODS, ...MOODS])).toEqual([...MOODS]);
      expect(normalizeMoods("cozy")).toEqual(["cozy"]);
      expect(normalizeMoods("dark")).toEqual(["dark"]);
    });

    it("rejects invalid strings, SQLi, XSS, prototype keys, and numbers in normalizeMoods", () => {
      const badMoods = [
        ...sqlInjectionVectors,
        ...xssVectors,
        ...protoPollutionKeys,
        "invalid_mood",
        123,
        null,
        undefined,
        {},
      ];
      expect(normalizeMoods(badMoods)).toEqual([]);
      expect(normalizeMoods(null)).toEqual([]);
      expect(normalizeMoods(undefined)).toEqual([]);
      expect(normalizeMoods(123)).toEqual([]);
      expect(normalizeMoods({})).toEqual([]);
    });

    it("normalizes valid paces and rejects invalid paces", () => {
      for (const pace of PACES) {
        expect(normalizePace(pace)).toBe(pace);
      }

      for (const sqli of sqlInjectionVectors) {
        expect(normalizePace(sqli)).toBeUndefined();
      }

      for (const key of protoPollutionKeys) {
        expect(normalizePace(key)).toBeUndefined();
      }

      expect(normalizePace(null)).toBeUndefined();
      expect(normalizePace(undefined)).toBeUndefined();
      expect(normalizePace(123)).toBeUndefined();
      expect(normalizePace({})).toBeUndefined();
      expect(normalizePace([])).toBeUndefined();
    });
  });

  // ==========================================
  // 6. getInitials & getDisplayName
  // ==========================================
  describe("getInitials & getDisplayName", () => {
    it("handles standard and Turkish names correctly", () => {
      expect(getInitials("Ada Lovelace")).toBe("AD");
      expect(getInitials("çağla demir")).toBe("ÇA");
      expect(getInitials("ömer can")).toBe("ÖM");
      expect(getInitials("şeref taş")).toBe("ŞE");
      expect(getInitials("A")).toBe("A");
    });

    it("handles fallback to email and 'U' default cleanly", () => {
      expect(getInitials(undefined, "jane@example.com")).toBe("JA");
      expect(getInitials("", "jane@example.com")).toBe("JA");
      expect(getInitials("   ", "jane@example.com")).toBe("JA");
      expect(getInitials()).toBe("U");
      expect(getInitials(undefined, undefined)).toBe("U");
      expect(getInitials("", "")).toBe("U");
    });

    it("fuzzes getInitials with unicode, zalgo, RTL, surrogate pairs, and 100k length strings", () => {
      expect(getInitials("👨‍👩‍👧‍👦 Family")).toBe("👨");
      expect(getInitials(extremeLengths.len100k)).toBe("EE");
      expect(getInitials(sqlInjectionVectors[0])).toBe("' ");
      expect(getInitials(xssVectors[0])).toBe("<S");
      expect(getInitials("__proto__")).toBe("__");
    });

    it("handles type confusion on getInitials without throwing", () => {
      expect(getInitials((123 as unknown as string), (456 as unknown as string))).toBe("U");
      expect(getInitials((null as unknown as string), (undefined as unknown as string))).toBe("U");
      expect(getInitials(([] as unknown as string), ({} as unknown as string))).toBe("U");
    });

    it("fuzzes getDisplayName with valid names, fallbacks, and type confusion", () => {
      expect(getDisplayName({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("Ada Lovelace");
      expect(getDisplayName({ email: "ada@example.com" })).toBe("ada@example.com");
      expect(getDisplayName({ name: "", email: "ada@example.com" })).toBe("ada@example.com");
      expect(getDisplayName({}, "Unnamed User")).toBe("Unnamed User");
      expect(getDisplayName(undefined, "Unnamed User")).toBe("Unnamed User");
      expect(getDisplayName(null as unknown as { name?: string }, "Unnamed User")).toBe("Unnamed User");
      expect(getDisplayName(123 as unknown as { name?: string }, "Unnamed User")).toBe("Unnamed User");
      expect(getDisplayName("string" as unknown as { name?: string }, "Unnamed User")).toBe("Unnamed User");
      // Locale-neutral default: empty fallback, never a hardcoded Turkish token.
      expect(getDisplayName({})).toBe("");
      expect(getDisplayName(undefined)).toBe("");

      // SQLi / XSS preserved safely as display string
      expect(getDisplayName({ name: "<script>alert(1)</script>" })).toBe("<script>alert(1)</script>");
      expect(getDisplayName({ name: "' OR '1'='1" })).toBe("' OR '1'='1");
    });
  });

  // ==========================================
  // 7. toIsoDate
  // ==========================================
  describe("toIsoDate (from progress)", () => {
    it("parses valid ISO and standard dates to ISO strings", () => {
      const parsed1 = toIsoDate("2026-08-18");
      expect(parsed1).toBeDefined();
      expect(parsed1?.startsWith("2026-08-18")).toBe(true);

      const parsed2 = toIsoDate("2026-08-18T12:00:00.000Z");
      expect(parsed2).toBe("2026-08-18T12:00:00.000Z");
    });

    it("returns null for corrupt, impossible, or out-of-range dates", () => {
      expect(toIsoDate("0000-00-00")).toBeNull();
      expect(toIsoDate("9999-99-99")).toBeNull();
      expect(toIsoDate("invalid-date-string")).toBeNull();
      expect(toIsoDate("2026-13-45")).toBeNull();
      expect(toIsoDate("")).toBeNull();
      expect(toIsoDate("   ")).toBeNull();
      expect(toIsoDate(null)).toBeNull();
      expect(toIsoDate(undefined)).toBeNull();
    });

    it("handles SQLi, XSS, proto keys, extreme dates without crashing", () => {
      for (const sqli of sqlInjectionVectors) {
        expect(toIsoDate(sqli)).toBeNull();
      }
      for (const xss of xssVectors) {
        expect(toIsoDate(xss)).toBeNull();
      }
      for (const proto of protoPollutionKeys) {
        expect(toIsoDate(proto)).toBeNull();
      }
      // Extreme dates
      expect(toIsoDate("100000-01-01T00:00:00.000Z")).toBeNull();
    });

    it("handles type confusion gracefully on toIsoDate", () => {
      expect(toIsoDate(12345 as unknown as string)).toBeNull();
      expect(toIsoDate(NaN as unknown as string)).toBeNull();
      expect(toIsoDate(Infinity as unknown as string)).toBeNull();
      expect(toIsoDate(true as unknown as string)).toBeNull();
      expect(toIsoDate([] as unknown as string)).toBeNull();
      expect(toIsoDate({} as unknown as string)).toBeNull();
    });
  });

  // ==========================================
  // 8. voteRecordId
  // ==========================================
  describe("voteRecordId", () => {
    it("generates deterministic 15-character base36 lowercase alphanumeric IDs", async () => {
      const id1 = await voteRecordId("title123", "user456");
      const id2 = await voteRecordId("title123", "user456");
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(15);
      expect(id1).toMatch(/^[0-9a-z]{15}$/);
    });

    it("differentiates order and parameter values", async () => {
      const id1 = await voteRecordId("abc", "def");
      const id2 = await voteRecordId("def", "abc");
      expect(id1).not.toBe(id2);
    });

    it("fuzzes voteRecordId with SQLi, XSS, proto keys, unicode, emojis, and 100k length strings", async () => {
      for (const sqli of sqlInjectionVectors) {
        const id = await voteRecordId(sqli, "user1");
        expect(id).toHaveLength(15);
        expect(id).toMatch(/^[0-9a-z]{15}$/);
      }

      for (const xss of xssVectors) {
        const id = await voteRecordId("title1", xss);
        expect(id).toHaveLength(15);
        expect(id).toMatch(/^[0-9a-z]{15}$/);
      }

      for (const proto of protoPollutionKeys) {
        const id = await voteRecordId(proto, proto);
        expect(id).toHaveLength(15);
        expect(id).toMatch(/^[0-9a-z]{15}$/);
      }

      for (const u of unicodeChaosVectors) {
        const id = await voteRecordId(u, "user_chaos");
        expect(id).toHaveLength(15);
        expect(id).toMatch(/^[0-9a-z]{15}$/);
      }

      const idHuge = await voteRecordId(extremeLengths.len100k, extremeLengths.len100k);
      expect(idHuge).toHaveLength(15);
      expect(idHuge).toMatch(/^[0-9a-z]{15}$/);
    });

    it("handles type confusion on voteRecordId without crashing", async () => {
      const idNull = await voteRecordId(null as unknown as string, undefined as unknown as string);
      expect(idNull).toHaveLength(15);
      expect(idNull).toMatch(/^[0-9a-z]{15}$/);

      const idNum = await voteRecordId(123 as unknown as string, 456 as unknown as string);
      expect(idNum).toHaveLength(15);
      expect(idNum).toMatch(/^[0-9a-z]{15}$/);
    });
  });
});
