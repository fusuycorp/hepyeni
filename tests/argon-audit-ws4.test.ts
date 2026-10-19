import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

const readRepoFile = (relPath: string) =>
  Bun.file(new URL(`../${relPath}`, import.meta.url)).text();

describe("Argon Audit Workstream 4 Remediation", () => {
  describe("P1-1: Circle settings page member email privacy", () => {
    it("narrows group_members expand.user query fields and projects with pickReviewerUser without rendering email", async () => {
      const src = await readRepoFile("src/app/groups/[groupId]/settings/page.tsx");
      expect(src).toContain(
        'fields: "id,group,user,role,joinedAt,createdAt,updatedAt,expand.user.id,expand.user.name,expand.user.avatarUrl"',
      );
      expect(src).toContain("pickReviewerUser");
      expect(src).not.toContain("m.expand?.user?.email");
      expect(src).not.toContain("const userEmail =");
    });
  });

  describe("P0-1: Group page inviteCode UI gate and email prop removal", () => {
    it("gates CopyInviteButton for guests, falls back when inviteCode is redacted, and omits currentUserEmail prop", async () => {
      const src = await readRepoFile("src/app/groups/[groupId]/page.tsx");
      expect(src).toContain("!access.isGuest && group.inviteCode");
      expect(src).toMatch(/group\.inviteCode\s*\?\s*`\/invite\?code=\$\{group\.inviteCode\}`\s*:\s*"\/(invite|login)"/);
      expect(src).not.toContain("currentUserEmail={currentUser?.email}");
    });
  });

  describe("P1-14: SpoilerText coverage across activity feed, campfires, and progress notes", () => {
    it("renders activity comment content through SpoilerText", async () => {
      const src = await readRepoFile("src/app/activity/page.tsx");
      expect(src).toContain("<SpoilerText text={comment.content} />");
    });

    it("wraps milestone campfire comments marked isSpoiler with || markers when not already tagged", async () => {
      const src = await readRepoFile("src/components/milestone-campfire-dialog.tsx");
      expect(src).toContain(
        '<SpoilerText text={c.isSpoiler && c.content && !c.content.includes("||") ? `||${c.content}||` : c.content} />',
      );
    });

    it("renders progress notes through SpoilerText in CircleTitleProgress and ShelfView", async () => {
      const circleProgressSrc = await readRepoFile("src/components/circle-title-progress.tsx");
      const shelfViewSrc = await readRepoFile("src/app/shelf/shelf-view.tsx");
      expect(circleProgressSrc).toContain("<SpoilerText text={progress.notes} />");
      expect(shelfViewSrc).toContain("<SpoilerText text={item.notes} />");
    });
  });

  describe("P2-3: Campfire moderation props and check-in unlock ordering", () => {
    it("forwards currentUserId, currentUserRole, and isAdmin from GroupContentView -> GroupSchedulesCard -> MilestoneCampfireDialog", async () => {
      const contentViewSrc = await readRepoFile("src/app/groups/[groupId]/group-content-view.tsx");
      const schedulesCardSrc = await readRepoFile("src/components/group-schedules-card.tsx");

      expect(schedulesCardSrc).toContain("currentUserId?: string;");
      expect(schedulesCardSrc).toContain("currentUserRole?: string;");
      expect(schedulesCardSrc).toContain("isAdmin?: boolean;");
      expect(schedulesCardSrc).toContain("currentUserId={currentUserId}");
      expect(schedulesCardSrc).toContain("currentUserRole={currentUserRole}");
      expect(schedulesCardSrc).toContain("isAdmin={isAdmin}");
      expect(contentViewSrc).toContain("currentUserId={currentUserId}");
      expect(contentViewSrc).toContain("currentUserRole={currentUserRole}");
      expect(contentViewSrc).toContain("isAdmin={isAdmin}");
    });

    it("awaits handleToggleCheckin before flipping campfireMilestone.hasCheckedIn", async () => {
      const schedulesCardSrc = await readRepoFile("src/components/group-schedules-card.tsx");
      expect(schedulesCardSrc).toContain("Promise<boolean>");
      expect(schedulesCardSrc).toMatch(/await\s+handleToggleCheckin\(milestoneId,\s*""\)/);
    });
  });

  describe("P2-11: Client state sync & render-phase setState fixes", () => {
    it("syncs quotes state with initialQuotes and wires empty-state AddQuoteDialog onSuccess", async () => {
      const src = await readRepoFile("src/app/shelf/quotes-tab.tsx");
      expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?setQuotes\(initialQuotes\);\s*\},\s*\[initialQuotes\]\)/);
      const onSuccessMatches = src.match(/onSuccess=\{/g) ?? [];
      expect(onSuccessMatches.length).toBeGreaterThanOrEqual(2);
    });

    it("resets selectedMood in all EmptyState clear-filters buttons in GroupContentView", async () => {
      const src = await readRepoFile("src/app/groups/[groupId]/group-content-view.tsx");
      const clearMoodMatches = src.match(/setSelectedMood\("all"\)/g) ?? [];
      // 1 in filter bar button, 1 in filter pill X button, 2 in EmptyState actions = at least 4
      expect(clearMoodMatches.length).toBeGreaterThanOrEqual(4);
    });

    it("moves setLocale into useEffect in error.tsx and global-error.tsx", async () => {
      const errorSrc = await readRepoFile("src/app/error.tsx");
      const globalErrorSrc = await readRepoFile("src/app/global-error.tsx");

      expect(errorSrc).not.toContain("if (locale !== cookieLocale) setLocale(cookieLocale);");
      expect(globalErrorSrc).not.toContain("if (locale !== cookieLocale) setLocale(cookieLocale);");
      expect(errorSrc).toContain("const copy = ERROR_COPY[locale];");
      expect(globalErrorSrc).toContain("const copy = ERROR_COPY[locale];");
    });
  });

  describe("P2-12: Dockerfile, .dockerignore, and GitHub Actions hardening", () => {
    it("pinsoven/bun:1.3.14-alpine and chains next build with && in Dockerfile", async () => {
      const dockerfile = await readRepoFile("Dockerfile");
      expect(dockerfile).toContain("FROM oven/bun:1.3.14-alpine AS base");
      expect(dockerfile).not.toContain("next build; test -f");
      expect(dockerfile).toMatch(/next build\s*&&\s*test -f \.next\/standalone\/server\.js/);
    });

    it("excludes non-runtime directories in .dockerignore", async () => {
      const dockerignore = await readRepoFile(".dockerignore");
      for (const entry of ["tests", "docs", ".agents", ".scratch", "reviews", ".git"]) {
        expect(dockerignore.split("\n").map((l) => l.trim())).toContain(entry);
      }
    });

    it("sets permissions, concurrency, curl --max-time 30, and changes result check in workflows", async () => {
      const ci = await readRepoFile(".github/workflows/ci.yml");
      const deploy = await readRepoFile(".github/workflows/deploy.yml");

      expect(ci).toContain("permissions:");
      expect(ci).toContain("contents: read");
      expect(deploy).toContain("permissions:");
      expect(deploy).toContain("contents: read");
      expect(deploy).toContain("concurrency:");
      expect(deploy).toContain("group: deploy-main");
      expect(deploy).toContain("cancel-in-progress: false");
      expect(deploy).toContain("--max-time 30");
      expect(deploy).toContain("needs.changes.result == 'success'");
    });
  });

  describe("P3-4: i18n hardcoded string elimination & locale parity", () => {
    it("uses t.common.refCode in export-card.tsx and import-preview-table.tsx", async () => {
      const exportCard = await readRepoFile("src/app/shelf/import-export/export-card.tsx");
      const previewTable = await readRepoFile("src/app/shelf/import-export/import-preview-table.tsx");

      expect(exportCard).not.toContain("Trace ID:");
      expect(exportCard).toContain('t.common.refCode.replace("{code}", res.traceId)');
      expect(previewTable).not.toContain("Trace ID:");
      expect(previewTable).toContain('t.common.refCode.replace("{code}", res.traceId)');
    });

    it("uses localized strings for No Cover, import limit, and Mobile Navigation aria-label", async () => {
      const addTitleForm = await readRepoFile("src/app/groups/[groupId]/add/add-title-form.tsx");
      const dropzone = await readRepoFile("src/app/shelf/import-export/import-dropzone.tsx");
      const bottomNav = await readRepoFile("src/components/bottom-nav.tsx");

      expect(addTitleForm).not.toContain(">No Cover<");
      expect(addTitleForm).toContain("{t.titles.noCover}");
      expect(dropzone).not.toContain("Import limit exceeded:");
      expect(dropzone).toContain("t.importExport.tooManyItems");
      expect(bottomNav).not.toContain('aria-label="Mobile Navigation"');
      expect(bottomNav).toContain("aria-label={t.nav.mobileNavAria}");

      expect(en.titles.noCover.length).toBeGreaterThan(0);
      expect(tr.titles.noCover.length).toBeGreaterThan(0);
      expect(en.importExport.tooManyItems).toContain("{max}");
      expect(tr.importExport.tooManyItems).toContain("{max}");
      expect(en.nav.mobileNavAria.length).toBeGreaterThan(0);
      expect(tr.nav.mobileNavAria.length).toBeGreaterThan(0);
    });
  });
});
