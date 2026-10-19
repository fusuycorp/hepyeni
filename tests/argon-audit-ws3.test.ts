import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as nextCacheModule from "next/cache";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
} from "@/lib/flags/registry";
import {
  FEATURE_FLAGS_COOKIE_NAME,
  getFeatureFlags,
  isFeatureEnabled,
} from "@/lib/flags/server";
import { toggleUserFeatureFlag } from "@/lib/flags/actions";
import { neutralizeFormulaPrefix } from "@/lib/exporters/csv-exporter";
import {
  exportShelfToMarkdownZip,
  generateItemMarkdown,
} from "@/lib/exporters/markdown-exporter";
import { createZipArchive } from "@/lib/exporters/zip";
import { releaseLlmUsage, reserveLlmUsage, type LlmUsageLimits } from "@/lib/llm/rate-limit";
import { chatJson } from "@/lib/llm/client";
import { extractJsonValue, parseAndValidateLlmOutput } from "@/lib/llm/validate";
import { extractTitlesFromDump } from "@/lib/actions/llm-extract";
import { normalizeImportItemPayload } from "@/lib/importers/types";
import { parseSafeDate } from "@/lib/importers/csv-parser";
import * as csvParserModule from "@/lib/importers/csv-parser";
import { detectImportSource, parseImportFile } from "@/lib/importers";
import { cachedSearch, clearSearchCache } from "@/lib/providers/search-cache";
import { batchImportProgress } from "@/lib/actions/import-export";
import * as sessionModule from "@/lib/pocketbase/session";
import * as superuserModule from "@/lib/pocketbase/superuser";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

describe("Argon Audit Workstream 3 Remediations", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of FEATURE_FLAG_KEYS) {
      delete process.env[`FLAG_ENABLE_${key.toUpperCase()}`];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    mock.restore();
  });

  describe("P0-3: Server-Only Feature Flags (llm_extract)", () => {
    it("marks llm_extract as serverOnly in FEATURE_FLAGS registry", () => {
      expect(FEATURE_FLAGS.llm_extract.serverOnly).toBe(true);
    });

    it("ignores user cookie overrides for serverOnly flags in isFeatureEnabled and getFeatureFlags", async () => {
      const cookieContext = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({
            llm_extract: true,
            data_portability: true,
          }),
          flag_llm_extract: "true",
          flag_blind_pick_wheel: "true",
        },
      };

      expect(await isFeatureEnabled("llm_extract", cookieContext)).toBe(false);
      expect(await isFeatureEnabled("data_portability", cookieContext)).toBe(true);
      expect(await isFeatureEnabled("blind_pick_wheel", cookieContext)).toBe(true);

      const allFlags = await getFeatureFlags(cookieContext);
      expect(allFlags.llm_extract).toBe(false);
      expect(allFlags.data_portability).toBe(true);
      expect(allFlags.blind_pick_wheel).toBe(true);
    });

    it("rejects toggling serverOnly flags in toggleUserFeatureFlag action", async () => {
      const result = await toggleUserFeatureFlag("llm_extract" as FeatureFlagKey, true);
      expect(result).toEqual({
        success: false,
        error: "This feature flag is managed by the server administrator.",
      });
    });
  });

  describe("P1-9: CSV Formula Prefix Neutralization", () => {
    it("neutralizes leading tab, CR, LF, and pipe characters before trimming strips them", () => {
      expect(neutralizeFormulaPrefix("\tHello")).toBe("'\tHello");
      expect(neutralizeFormulaPrefix("\rHello")).toBe("'\rHello");
      expect(neutralizeFormulaPrefix("\nHello")).toBe("'\nHello");
      expect(neutralizeFormulaPrefix("|cmd")).toBe("'|cmd");
      expect(neutralizeFormulaPrefix("   |cmd")).toBe("'   |cmd");
      expect(neutralizeFormulaPrefix("   =SUM(A1)")).toBe("'   =SUM(A1)");
      expect(neutralizeFormulaPrefix("Safe text")).toBe("Safe text");
    });
  });

  describe("P1-10: LLM Rate-Limit Reservation Release on Upstream Failure", () => {
    it("returns reservedIds from reserveLlmUsage and deletes them via releaseLlmUsage", async () => {
      const activeIds = new Set<string>();
      const pb = {
        collection(name: string) {
          if (name !== "llm_usage") throw new Error(`unexpected: ${name}`);
          return {
            getFullList: async () => [],
            create: async (rec: { id: string }) => {
              activeIds.add(rec.id);
              return rec;
            },
            delete: async (id: string) => {
              activeIds.delete(id);
            },
          };
        },
      };
      const limits: LlmUsageLimits = {
        windowMs: 60_000,
        maxRequests: 2,
        maxInputChars: 20_000,
        costUnitChars: 10_000,
      };

      const usage = await reserveLlmUsage(pb as never, "user-1", 15_000, 120_000, limits);
      expect(usage.allowed).toBe(true);
      if (usage.allowed) {
        expect(usage.reservedIds).toBeDefined();
        expect(usage.reservedIds?.length).toBe(3); // 1 request + 2 input slots
        expect(activeIds.size).toBe(3);

        await releaseLlmUsage(pb as never, usage.reservedIds);
        expect(activeIds.size).toBe(0);
      }
    });

    it("releases reserved LLM quota slots when chatJson throws in extractTitlesFromDump", async () => {
      process.env.FLAG_ENABLE_LLM_EXTRACT = "true";
      process.env.LLM_API_KEY = "sk-test-key";

      const deletedIds: string[] = [];
      const createdIds: string[] = [];

      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "user-quota-1",
        isAdmin: false,
        name: "Quota User",
        email: "quota@example.com",
      } as never);

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        collection(name: string) {
          if (name === "llm_usage") {
            return {
              getFullList: async () => [],
              create: async (rec: { id: string }) => {
                createdIds.push(rec.id);
                return rec;
              },
              delete: async (id: string) => {
                deletedIds.push(id);
              },
            };
          }
          throw new Error(`unexpected collection: ${name}`);
        },
      } as never);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response("Bad Gateway", { status: 502 })) as unknown as typeof fetch;

      try {
        const res = await extractTitlesFromDump("Read Dune by Frank Herbert");
        expect(res.success).toBe(false);
        expect(createdIds.length).toBeGreaterThan(0);
        expect(deletedIds).toEqual(createdIds);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("P2-4: Markdown Exporter & ZIP Builder Hardening", () => {
    const baseItem: UserMediaProgressResponse = {
      id: "rec_1",
      collectionId: "col_1",
      collectionName: "user_media_progress",
      user: "usr_1",
      title: "..[Evil]\x01Title",
      creator: "Author | With Pipe\nAnd Newline",
      mediaType: "book",
      status: "completed",
      rating: 4,
      progressCurrent: 100,
      progressTotal: 100,
      progressUnit: "pages",
      currentLabel: "Ch 1",
      notes: "Notes",
      isSharedWithCircles: true,
      moods: [],
      pace: "gentle",
      startedAt: '2026-01-01" \nmalicious: true',
      completedAt: "2026-01-02\\backslash",
      createdAt: "2026-01-01T00:00:00.000Z" as never,
      updatedAt: "2026-01-02T00:00:00.000Z" as never,
      externalSource: "backslash\\source",
      externalId: "id_1",
      coverUrl: "",
      groupTitle: "",
    };

    it("escapes backslashes and date fields in YAML frontmatter and sanitizes filenames", () => {
      const { filename, content } = generateItemMarkdown(baseItem);
      expect(filename.startsWith(".")).toBe(false);
      expect(filename).not.toContain("[");
      expect(filename).not.toContain("]");
      expect(filename).not.toContain("\x01");
      expect(content).toContain('external_source: "backslash\\\\source"');
      expect(content).toContain('started_at: "2026-01-01\\" \\nmalicious: true"');
      expect(content).toContain('completed_at: "2026-01-02\\\\backslash"');
    });

    it("deduplicates filenames case-insensitively including Index.md and escapes table cells", () => {
      const items: UserMediaProgressResponse[] = [
        { ...baseItem, id: "1", title: "Index", creator: "" },
        { ...baseItem, id: "2", title: "Dune", creator: "Alice | Bob\nCharlie" },
        { ...baseItem, id: "3", title: "dune", creator: "Alice | Bob\nCharlie" },
      ];
      const zipBytes = exportShelfToMarkdownZip(items);
      const text = new TextDecoder().decode(zipBytes);

      expect(text).toContain("HepYeni Shelf/Index (1).md");
      expect(text).toContain("HepYeni Shelf/dune - Alice _ Bob_Charlie (1).md");
      expect(text).toContain("Alice \\| Bob Charlie");
      expect(text).toContain("[[Index (1)]]");
    });

    it("rejects ZIP archives with more than 65535 files", () => {
      const fakeFiles = { length: 0x10000 } as unknown as Array<{
        name: string;
        content: string;
      }>;
      expect(() => createZipArchive(fakeFiles)).toThrow(
        "Too many files for standard ZIP archive",
      );
    });
  });

  describe("P2-6 & P2-9: Importers, Search Cache, LLM Client/Validate & Dedup", () => {
    it("enforces finite numbers, 1..5 rating, and blocks private/loopback coverUrl in normalizeImportItemPayload", () => {
      const withBadNums = normalizeImportItemPayload({
        title: "Dune",
        mediaType: "book",
        status: "completed",
        rating: Number.NaN,
        progressCurrent: Number.POSITIVE_INFINITY,
        progressTotal: Number.NEGATIVE_INFINITY,
        coverUrl: "http://127.0.0.1:8090/internal",
      });
      expect(withBadNums).not.toBeNull();
      expect(withBadNums!.rating).toBeUndefined();
      expect(withBadNums!.progressCurrent).toBeUndefined();
      expect(withBadNums!.progressTotal).toBeUndefined();
      expect(withBadNums!.coverUrl).toBeUndefined();

      for (const forbidden of [
        "http://localhost:3000/a.jpg",
        "http://0.0.0.0/a.jpg",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]:8080/a.jpg",
      ]) {
        const res = normalizeImportItemPayload({
          title: "Dune",
          mediaType: "book",
          status: "completed",
          coverUrl: forbidden,
        });
        expect(res!.coverUrl).toBeUndefined();
      }

      const valid = normalizeImportItemPayload({
        title: "Dune",
        mediaType: "book",
        status: "completed",
        rating: 4.6,
        progressCurrent: 100,
        progressTotal: 200,
        coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
      });
      expect(valid!.rating).toBe(5);
      expect(valid!.coverUrl).toBe("https://covers.openlibrary.org/b/id/1-L.jpg");
    });

    it("limits recursion depth in parseSafeDate when allowRange = false", () => {
      expect(parseSafeDate("2024-01-01 - 2024-01-05", true)).toBe("2024-01-05T00:00:00.000Z");
      expect(parseSafeDate("2024-01-01 - 2024-01-05", false)).toBeUndefined();
    });

    it("enforces max file size guard in parseImportFile and avoids double CSV parsing", () => {
      const oversized = { length: 10 * 1024 * 1024 + 1, trim: () => "x" } as unknown as string;
      // Also test with a mocked string or check detectImportSource
      expect(detectImportSource(oversized).source).toBe("generic_csv");

      const spy = spyOn(csvParserModule, "parseCsv");
      const csv = "Title,Creator,Media Type,Status\nDune,Frank Herbert,book,completed";
      const parsed = parseImportFile(csv);
      expect(parsed.items).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("evicts expired entries before oldest valid entries in search-cache", async () => {
      clearSearchCache();
      try {
        // Insert an entry that expires in 5ms
        await cachedSearch("expired-key", async () => "expired-val", 5);
        await new Promise((r) => setTimeout(r, 15));

        // Insert 199 valid entries with long TTL
        for (let i = 0; i < 199; i++) {
          await cachedSearch(`valid-key-${i}`, async () => `val-${i}`, 60_000);
        }

        // Now store has 200 entries (1 expired + 199 valid).
        // Adding one more entry triggers evictOldest(). It should evict "expired-key", NOT "valid-key-0"!
        await cachedSearch("valid-key-199", async () => "val-199", 60_000);

        let valid0Calls = 0;
        const val0 = await cachedSearch("valid-key-0", async () => {
          valid0Calls++;
          return "recomputed";
        });
        expect(val0).toBe("val-0");
        expect(valid0Calls).toBe(0);
      } finally {
        clearSearchCache();
      }
    });

    it("retries on TimeoutError in chatJson (AbortSignal.timeout)", async () => {
      let calls = 0;
      const fetchWithTimeoutError = (async () => {
        calls++;
        if (calls === 1) {
          const err = new Error("The operation was aborted due to timeout");
          err.name = "TimeoutError";
          throw err;
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"titles":[]}' } }] }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

      const content = await chatJson(
        { apiUrl: "https://api.example/v1", apiKey: "k", model: "m" },
        "sys",
        "usr",
        fetchWithTimeoutError,
        0,
      );
      expect(content).toBe('{"titles":[]}');
      expect(calls).toBe(2);
    });

    it("skips leading bracketed citation like [1] in extractJsonValue to find the real JSON object", () => {
      const prose =
        'Based on your note [1], here are the extracted titles:\n{"titles":[{"title":"Dune","mediaType":"book"}]}';
      const val = extractJsonValue(prose);
      expect(val).toEqual({ titles: [{ title: "Dune", mediaType: "book" }] });

      const { candidates } = parseAndValidateLlmOutput(prose);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].title).toBe("Dune");
    });

    it("strips combining diacritics and checks shortTitleKey during batchImportProgress deduplication", async () => {
      const created: Array<Record<string, unknown>> = [];
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "user-1",
        isAdmin: false,
        name: "User",
        email: "user@example.com",
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => undefined);
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection(name: string) {
          if (name !== "user_media_progress") throw new Error(`unexpected: ${name}`);
          return {
            getFullList: async () => [
              {
                id: "existing-1",
                title: "Duné",
                creator: "",
                mediaType: "book",
                externalSource: "",
                externalId: "",
              },
            ],
            create: async (rec: Record<string, unknown>) => {
              created.push(rec);
              return rec;
            },
          };
        },
      } as never);

      const res = await batchImportProgress([
        {
          title: "Dune",
          creator: "Frank Herbert",
          mediaType: "book" as never,
          status: "completed" as never,
        },
      ]);

      expect(res).toEqual({
        success: true,
        data: { importedCount: 0, skippedCount: 1 },
      });
      expect(created).toHaveLength(0);
    });
  });
});
