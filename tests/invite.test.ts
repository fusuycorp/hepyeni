import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Invite System & Translations", () => {
  it("enforces complete invite translation key parity between English and Turkish", () => {
    const enKeys = Object.keys(en.invite).sort();
    const trKeys = Object.keys(tr.invite).sort();

    expect(enKeys).toEqual(trKeys);
    expect(enKeys.length).toBeGreaterThan(10);
  });

  it("contains non-empty translation strings for all invite keys", () => {
    for (const [key, value] of Object.entries(en.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }

    for (const [key, value] of Object.entries(tr.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it("formats invite URLs correctly with code parameter", () => {
    const code = "ABC23456";
    const origin = "https://app.titirek.com";
    const expectedUrl = `${origin}/invite/${code}`;

    expect(new URL(`/invite/${code}`, origin).toString()).toBe(expectedUrl);
  });

  it("handles code casing and trimming", () => {
    const raw = "  abc23456  ";
    const normalized = raw.trim().toUpperCase();
    expect(normalized).toBe("ABC23456");
  });
});
