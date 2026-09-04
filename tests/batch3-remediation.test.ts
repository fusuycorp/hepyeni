import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { getLlmUsageLimits } from "@/lib/llm/rate-limit";

describe("Batch 3 Remediation: Polish, Documentation & Admin UX", () => {
  describe("1. Environment Variables in .env.example", () => {
    it("documents all required environment variables with safe defaults and explanations", () => {
      expect(existsSync(".env.example")).toBe(true);
      const content = readFileSync(".env.example", "utf8");

      expect(content).toContain("GOOGLE_BOOKS_API_KEY=");
      expect(content).toContain("TRUST_FORWARDED_HEADERS=");
      expect(content).toContain("APP_URL=http://localhost:3000");
      expect(content).toContain("LLM_HOURLY_REQUEST_LIMIT=5");
      expect(content).toContain("LLM_HOURLY_COST_LIMIT=120000");
    });

    it("verifies getLlmUsageLimits parses LLM_HOURLY_REQUEST_LIMIT and LLM_HOURLY_COST_LIMIT", () => {
      const prevReq = process.env.LLM_HOURLY_REQUEST_LIMIT;
      const prevCost = process.env.LLM_HOURLY_COST_LIMIT;

      try {
        process.env.LLM_HOURLY_REQUEST_LIMIT = "10";
        process.env.LLM_HOURLY_COST_LIMIT = "250000";

        const limits = getLlmUsageLimits();
        expect(limits.maxRequests).toBe(10);
        expect(limits.maxInputChars).toBe(250000);
      } finally {
        if (prevReq === undefined) delete process.env.LLM_HOURLY_REQUEST_LIMIT;
        else process.env.LLM_HOURLY_REQUEST_LIMIT = prevReq;

        if (prevCost === undefined) delete process.env.LLM_HOURLY_COST_LIMIT;
        else process.env.LLM_HOURLY_COST_LIMIT = prevCost;
      }
    });
  });

  describe("2. Admin Confirmation Dialogs (ADR-009)", () => {
    it("guards destructive group deletion in admin/groups/page.tsx with confirmation dialog", () => {
      const content = readFileSync("src/app/admin/groups/page.tsx", "utf8");

      // Verifies ConfirmActionButton is imported
      expect(content).toContain('import { ConfirmActionButton } from "@/components/confirm-action-button";');

      // Verifies no direct unconfirmed form action for adminDeleteGroup
      expect(content).not.toMatch(/<form[^>]*action=\{[^}]*adminDeleteGroup/);

      // Verifies ConfirmActionButton binds adminDeleteGroup
      expect(content).toContain("onConfirm={adminDeleteGroup.bind(null, group.id)}");
    });

    it("guards destructive actions in admin/groups/[groupId]/page.tsx with confirmation dialogs", () => {
      const content = readFileSync("src/app/admin/groups/[groupId]/page.tsx", "utf8");

      // Verifies ConfirmActionButton is imported
      expect(content).toContain('import { ConfirmActionButton } from "@/components/confirm-action-button";');

      // Verifies no unconfirmed form actions for title deletion or member removal
      expect(content).not.toMatch(/<form[^>]*action=\{[^}]*adminDeleteTitle/);
      expect(content).not.toMatch(/<form[^>]*action=\{[^}]*adminRemoveGroupMember/);

      // Verifies ConfirmActionButton binds adminDeleteTitle, adminDeleteReview, and adminRemoveGroupMember
      expect(content).toContain("onConfirm={adminDeleteTitle.bind(null, title.id, groupId)}");
      expect(content).toContain("onConfirm={adminDeleteReview.bind(null, review.id, groupId)}");
      expect(content).toContain("onConfirm={adminRemoveGroupMember.bind(null, groupId, m.user)}");
    });

    it("guards user banning in admin/users/page.tsx with confirmation dialog", () => {
      const content = readFileSync("src/app/admin/users/page.tsx", "utf8");

      // Verifies ConfirmActionButton is imported
      expect(content).toContain('import { ConfirmActionButton } from "@/components/confirm-action-button";');

      // Verifies ban action requires confirmation and is not in a raw form action
      expect(content).toContain("onConfirm={banUser.bind(null, user.id)}");
      expect(content).not.toMatch(/action=\{[^}]*await\s+banUser/);
    });
  });

  describe("3. Schema Documentation & Relational Lifecycle Reconciliation (ADR-015)", () => {
    it("documents titles.status and user_media_progress relational lifecycle in docs/DATA_MODELS.md", () => {
      const content = readFileSync("docs/DATA_MODELS.md", "utf8");

      // Titles status stores proposed or consumed in PB
      expect(content).toContain('Values: `["proposed", "consumed"]`');
      expect(content).toContain("The communal \"In Progress\" section in the circle UI is derived relationally from `user_media_progress`");

      // Documents groupTitle cascade handling
      expect(content).toContain("relation cascade is handled by PocketBase or application logic");

      // Documents 3-section lifecycle partition
      expect(content).toContain("Relational Progress Lifecycle (ADR-015)");
      expect(content).toContain("categorizeCircleTitles");
    });

    it("documents relational lifecycle and categorizeCircleTitles partition in DECISIONS.md", () => {
      const content = readFileSync("DECISIONS.md", "utf8");

      // ADR-015 section
      expect(content).toContain("## ADR-015: 3-Section Circle Media Lifecycle");
      expect(content).toContain("`titles` in PocketBase holds either `proposed` or `consumed` status");
      expect(content).toContain("`categorizeCircleTitles`");
      expect(content).toContain("user_media_progress");
    });
  });
});
