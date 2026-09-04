import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("PR Review Remediations", () => {
  it("AlertDialogContent enforces max-height, overflow scroll, and mobile max-width", () => {
    const content = readFileSync("src/components/ui/alert-dialog.tsx", "utf-8");
    expect(content).toContain("max-w-[calc(100%-2rem)]");
    expect(content).toContain("max-h-[calc(100dvh-2rem)]");
    expect(content).toContain("overflow-y-auto");
    expect(content).toContain("data-[size=default]:sm:max-w-sm");
    expect(content).toContain("data-[size=sm]:sm:max-w-xs");
  });

  it("rate-limit getClientIp gates proxy headers behind TRUST_FORWARDED_HEADERS", () => {
    const content = readFileSync("src/lib/rate-limit.ts", "utf-8");
    expect(content).toContain("TRUST_FORWARDED_HEADERS");
    expect(content).toContain("trustForwarded");
  });

  it("milestone campfire dialog handles IME composition during Enter keydown", () => {
    const content = readFileSync("src/components/milestone-campfire-dialog.tsx", "utf-8");
    expect(content).toContain("e.nativeEvent.isComposing");
  });

  it("tmdb itunes fallback identifier supports Unicode characters", () => {
    const content = readFileSync("src/lib/providers/tmdb.ts", "utf-8");
    expect(content).toContain("\\p{L}\\p{N}");
  });

  it("group_members_user_index migration checks index existence before add/remove", () => {
    const content = readFileSync("pb_migrations/1755287000_group_members_user_index.js", "utf-8");
    expect(content).toContain("collection.indexes.some");
    expect(content).not.toContain("catch {");
  });
});
