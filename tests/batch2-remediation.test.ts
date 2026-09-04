import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "fs";
import {
  pruneExpiredLlmUsage,
  reserveLlmUsage,
  LLM_USAGE_COLLECTION,
  type LlmUsageLimits,
} from "@/lib/llm/rate-limit";
import type { Session } from "@/lib/pocketbase/session";

describe("Batch 2 Remediation: Invariants, Performance & Robustness", () => {
  describe("1. Page Action Wrappers Return Action Results", () => {
    it("returns await in groups/[groupId]/page.tsx server action wrappers", () => {
      const content = readFileSync("src/app/groups/[groupId]/page.tsx", "utf8");

      expect(content).toMatch(/async function handleVote\([^)]*\)\s*\{[\s\S]*?return await voteOnTitle/);
      expect(content).toMatch(/async function handleStartConsuming\([^)]*\)\s*\{[\s\S]*?return await startConsuming/);
      expect(content).toMatch(/async function handleMarkConsumed\([^)]*\)\s*\{[\s\S]*?return await markConsumed/);
      expect(content).toMatch(/async function handleUnmarkConsumed\([^)]*\)\s*\{[\s\S]*?return await unmarkConsumed/);
      expect(content).toMatch(/async function handleSubmitReview\([^)]*\)\s*\{[\s\S]*?return await submitReview/);
      expect(content).toMatch(/async function handleDeleteComment\([^)]*\)\s*\{[\s\S]*?return await deleteComment/);
    });

    it("returns await in groups/[groupId]/titles/[titleId]/page.tsx action wrappers", () => {
      const content = readFileSync(
        "src/app/groups/[groupId]/titles/[titleId]/page.tsx",
        "utf8",
      );

      expect(content).toMatch(/async function handleVote\([^)]*\)\s*\{[\s\S]*?return await voteOnTitle/);
      expect(content).toMatch(/async function handleMarkConsumed\([^)]*\)\s*\{[\s\S]*?return await markConsumed/);
      expect(content).toMatch(/async function handleUnmarkConsumed\([^)]*\)\s*\{[\s\S]*?return await unmarkConsumed/);
      expect(content).toMatch(/async function handleSubmitReview\([^)]*\)\s*\{[\s\S]*?return await submitReview/);
      expect(content).toMatch(/async function handleDeleteComment\([^)]*\)\s*\{[\s\S]*?return await deleteComment/);
    });
  });

  describe("2. Index Migration on user_media_progress(groupTitle, status)", () => {
    it("exists and defines idx_user_progress_group_title", () => {
      const migrationPath =
        "pb_migrations/1755288100_user_media_progress_group_title_index.js";
      expect(existsSync(migrationPath)).toBe(true);

      const migrationContent = readFileSync(migrationPath, "utf8");
      expect(migrationContent).toContain("user_media_progress");
      expect(migrationContent).toContain("idx_user_progress_group_title");
      expect(migrationContent).toContain(
        "CREATE INDEX idx_user_progress_group_title ON user_media_progress (groupTitle, status)",
      );
    });
  });

  describe("3. Mobile Ergonomics & Safe-Area Alignment (ADR-018)", () => {
    it("exports viewport with viewportFit: 'cover' in layout.tsx", () => {
      const layoutContent = readFileSync("src/app/layout.tsx", "utf8");
      expect(layoutContent).toMatch(/export const viewport:\s*Viewport\s*=\s*\{[\s\S]*?viewportFit:\s*"cover"/);
    });

    it("uses safe-area inset calc for floating action button in group page", () => {
      const groupPageContent = readFileSync(
        "src/app/groups/[groupId]/page.tsx",
        "utf8",
      );
      expect(groupPageContent).toContain(
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-8",
      );
    });

    it("verifies inputs do not override with text-xs across audited forms", () => {
      const auditedFiles = [
        "src/app/login/page.tsx",
        "src/app/reset-password/page.tsx",
        "src/app/groups/[groupId]/add/add-title-form.tsx",
        "src/app/shelf/add-to-shelf-dialog.tsx",
        "src/app/shelf/edit-progress-dialog.tsx",
        "src/components/comment-thread.tsx",
        "src/components/milestone-campfire-dialog.tsx",
        "src/components/review-form.tsx",
        "src/components/add-quote-dialog.tsx",
      ];

      for (const file of auditedFiles) {
        const content = readFileSync(file, "utf8");
        // Ensure no Input or Textarea has className containing "text-xs" without responsive md:text-sm or text-base
        const matches = content.match(/<(?:Input|Textarea)[^>]*className="[^"]*text-xs[^"]*"/g);
        if (matches) {
          // If text-xs is present, it must be qualified by responsive prefixes like md:text-xs or text-base
          for (const match of matches) {
            expect(match).toMatch(/text-base/);
          }
        }
      }
    });

    it("adds max-h-[85dvh] and overflow-y-auto to mobile dialogs", () => {
      const loginContent = readFileSync("src/app/login/page.tsx", "utf8");
      expect(loginContent).toContain("max-h-[85dvh]");
      expect(loginContent).toContain("overflow-y-auto");

      const wheelContent = readFileSync(
        "src/components/decision-wheel-dialog.tsx",
        "utf8",
      );
      expect(wheelContent).toContain("max-h-[85dvh]");
      expect(wheelContent).toContain("overflow-y-auto");
    });
  });

  describe("4. Pruning Expired LLM Quota Reservations (ADR-014)", () => {
    it("deletes records where window < currentWindow - 1", async () => {
      const deletedIds: string[] = [];
      const records = [
        { id: "old-1", window: "10" },
        { id: "old-2", window: "11" },
        { id: "previous-window", window: "12" }, // currentWindow - 1 (kept)
        { id: "current-window", window: "13" },  // currentWindow (kept)
      ];

      const mockPb = {
        collection(name: string) {
          if (name !== LLM_USAGE_COLLECTION) throw new Error("Unexpected collection");
          return {
            getFullList: async ({ filter: _filter }: { filter?: string } = {}) => {
              // Simulate filter for window < "12"
              return records.filter((r) => Number.parseInt(r.window, 10) < 12);
            },
            delete: async (id: string) => {
              deletedIds.push(id);
            },
          };
        },
      };

      await pruneExpiredLlmUsage(mockPb as never, 13);

      expect(deletedIds).toContain("old-1");
      expect(deletedIds).toContain("old-2");
      expect(deletedIds).not.toContain("previous-window");
      expect(deletedIds).not.toContain("current-window");
    });

    it("runs lazy pruning during reserveLlmUsage", async () => {
      const deletedIds: string[] = [];
      const createdRecords: Array<Record<string, unknown>> = [];
      const records = [
        { id: "expired-record", window: "0" },
      ];

      const limits: LlmUsageLimits = {
        windowMs: 60_000,
        maxRequests: 2,
        maxInputChars: 20_000,
        costUnitChars: 10_000,
      };

      const mockPb = {
        collection(name: string) {
          if (name !== LLM_USAGE_COLLECTION) throw new Error("Unexpected collection");
          return {
            getFullList: async () => records,
            create: async (record: Record<string, unknown>) => {
              createdRecords.push(record);
              return record;
            },
            delete: async (id: string) => {
              deletedIds.push(id);
            },
          };
        },
      };

      const now = 600_000; // window = 10
      const result = await reserveLlmUsage(mockPb as never, "user-1", 5000, now, limits);

      expect(result).toEqual({ allowed: true });
      expect(deletedIds).toContain("expired-record");
    });
  });

  describe("5. Session.avatarUrl and Elimination of Redundant users.getOne", () => {
    it("defines optional avatarUrl on Session type", () => {
      const sessionContent = readFileSync(
        "src/lib/pocketbase/session.ts",
        "utf8",
      );
      expect(sessionContent).toContain("avatarUrl?: string;");

      const dummySession: Session = {
        id: "usr_123",
        isAdmin: false,
        name: "Test User",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
      };
      expect(dummySession.avatarUrl).toBe("https://example.com/avatar.jpg");
    });

    it("verifies SSR pages do not query users.getOne for current user avatar", () => {
      const ssrPages = [
        "src/app/shelf/page.tsx",
        "src/app/page.tsx",
        "src/app/groups/[groupId]/page.tsx",
        "src/app/groups/[groupId]/titles/[titleId]/page.tsx",
        "src/app/groups/page.tsx",
        "src/app/groups/[groupId]/add/page.tsx",
        "src/app/activity/page.tsx",
        "src/app/groups/[groupId]/settings/page.tsx",
      ];

      for (const file of ssrPages) {
        const content = readFileSync(file, "utf8");
        expect(content).not.toContain('.collection("users").getOne');
      }
    });
  });
});
