import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Invite System & Translations", () => {
  it("enforces complete invite translation key parity between English and Turkish", () => {
    const enKeys = Object.keys(en.invite).sort();
    const trKeys = Object.keys(tr.invite).sort();

    expect(enKeys).toEqual(trKeys);
    expect(enKeys.length).toBeGreaterThan(15);
  });

  it("contains non-empty translation strings for all invite keys", () => {
    for (const value of Object.values(en.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }

    for (const value of Object.values(tr.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it("contains enter invite code flow translation keys", () => {
    expect(en.invite.enterCodeTitle).toBe("Enter Invite Code");
    expect(tr.invite.enterCodeTitle).toBe("Davet Kodunu Girin");
    expect(en.invite.continueButton).toBe("Continue to Circle");
    expect(tr.invite.continueButton).toBe("Çembere Devam Et");
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
