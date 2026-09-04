import { describe, expect, it } from "bun:test";
import { generateItemMarkdown } from "@/lib/exporters/markdown-exporter";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";
import fs from "node:fs";
import path from "node:path";

describe("Batch 1 Remediation Verifications", () => {
  describe("Security: Markdown YAML frontmatter sanitization", () => {
    it("escapes externalSource with quotes, colons, and special characters", () => {
      const dummyItem: UserMediaProgressResponse = {
        id: "rec_123",
        user: "user_1",
        title: "Normal Title",
        creator: "Some Author",
        coverUrl: "https://example.com/cover.jpg",
        mediaType: "book",
        status: "completed",
        externalSource: 'evil"source: [with]: "special" chars',
        externalId: "ext-456",
        groupTitle: "",
        currentLabel: "",
        notes: "",
        rating: 4,
        progressCurrent: 100,
        progressTotal: 100,
        progressUnit: "pages",
        isSharedWithCircles: true,
        moods: [],
        pace: "gentle",
        startedAt: "2026-01-01",
        completedAt: "2026-01-02",
        createdAt: "2026-01-01 00:00:00.000Z" as never,
        updatedAt: "2026-01-02 00:00:00.000Z" as never,
        collectionId: "user_media_progress",
        collectionName: "user_media_progress",
      };

      const { content } = generateItemMarkdown(dummyItem);
      expect(content).toContain(
        'external_source: "evil\\"source: [with]: \\"special\\" chars"',
      );
    });
  });

  describe("Security: Sealed Server Action exports in groups.ts", () => {
    it("does NOT export raw joinGroupByCode or autoJoinPendingInvite from actions/groups", async () => {
      const groupsActions = await import("@/lib/actions/groups");
      expect((groupsActions as Record<string, unknown>).joinGroupByCode).toBeUndefined();
      expect((groupsActions as Record<string, unknown>).autoJoinPendingInvite).toBeUndefined();
    });

    it("exports joinGroupByCode and autoJoinPendingInvite from invites, keeping queries/groups strictly read-only", async () => {
      const invites = await import("@/lib/invites");
      expect(typeof invites.joinGroupByCode).toBe("function");
      expect(typeof invites.autoJoinPendingInvite).toBe("function");

      const groupsQueries = await import("@/lib/queries/groups");
      expect(typeof groupsQueries.getGroupByInviteCode).toBe("function");
      expect((groupsQueries as Record<string, unknown>).joinGroupByCode).toBeUndefined();
      expect((groupsQueries as Record<string, unknown>).autoJoinPendingInvite).toBeUndefined();
    });
  });

  describe("Security: Query modules lack 'use server' directive", () => {
    const queryFiles = [
      "src/lib/queries/progress.ts",
      "src/lib/queries/marginalia.ts",
      "src/lib/queries/schedules.ts",
      "src/lib/queries/groups.ts",
    ];

    for (const file of queryFiles) {
      it(`verifies ${file} does NOT contain 'use server'`, () => {
        const fullPath = path.join(process.cwd(), file);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code).not.toContain('"use server"');
        expect(code).not.toContain("'use server'");
      });
    }
  });

  describe("Security: Lock users collection migration", () => {
    it("migration file exists and locks all collection rules to null", () => {
      const migPath = path.join(
        process.cwd(),
        "pb_migrations/1755288000_lock_users_collection.js",
      );
      expect(fs.existsSync(migPath)).toBe(true);
      const content = fs.readFileSync(migPath, "utf-8");
      expect(content).toContain('collection.listRule = null;');
      expect(content).toContain('collection.viewRule = null;');
      expect(content).toContain('collection.createRule = null;');
      expect(content).toContain('collection.updateRule = null;');
      expect(content).toContain('collection.deleteRule = null;');
    });
  });

  describe("Security: Apple OAuth cookie configuration", () => {
    it("verifies pb_oauth_state cookie uses secure: true and sameSite: 'none'", () => {
      const sessionPath = path.join(process.cwd(), "src/lib/pocketbase/session.ts");
      const content = fs.readFileSync(sessionPath, "utf-8");
      expect(content).toContain('sameSite: "none"');
      expect(content).toContain("secure: true");
    });
  });

  describe("Reliability: Import/Export unbounded clamping check", () => {
    it("verifies exportShelfData and batchImportProgress use getFullList with batch: 500", () => {
      const importExportPath = path.join(
        process.cwd(),
        "src/lib/actions/import-export.ts",
      );
      const content = fs.readFileSync(importExportPath, "utf-8");
      // Must not use getList with MAX_EXPORT_ROWS or MAX_IMPORT_ITEMS
      expect(content).not.toContain(".getList<UserMediaProgressResponse>(1, MAX_EXPORT_ROWS");
      expect(content).not.toContain(".getList<UserMediaProgressResponse>(1, MAX_IMPORT_ITEMS");
      expect(content).toContain("batch: 500");
    });
  });
});
