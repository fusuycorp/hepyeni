import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Landing Page - Translation Parity & Aesthetic Tone", () => {
  it("enforces complete key parity between EN and TR for landing section", () => {
    const landingKeys = Object.keys(en.landing) as (keyof typeof en.landing)[];
    expect(landingKeys.length).toBeGreaterThan(15);

    for (const key of landingKeys) {
      expect(en.landing[key]).toBeDefined();
      expect(tr.landing[key]).toBeDefined();
      expect(typeof en.landing[key]).toBe("string");
      expect(typeof tr.landing[key]).toBe("string");
      expect(en.landing[key].trim().length).toBeGreaterThan(0);
      expect(tr.landing[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("verifies welcomeBack interpolation token in both languages", () => {
    expect(en.landing.welcomeBack).toContain("{name}");
    expect(tr.landing.welcomeBack).toContain("{name}");

    const formattedEn = en.landing.welcomeBack.replace("{name}", "Ahmet");
    const formattedTr = tr.landing.welcomeBack.replace("{name}", "Ahmet");

    expect(formattedEn).toBe("Welcome back, Ahmet");
    expect(formattedTr).toBe("Tekrar hoş geldin, Ahmet");
  });

  it("reflects the warm, unhurried, patient tone in English and Turkish copy", () => {
    // English tone assertions
    expect(en.landing.heroTitle.toLowerCase()).toContain("slow");
    expect(en.landing.heroSubtitle.toLowerCase()).toContain("savor");
    expect(en.landing.getStarted.toLowerCase()).toContain("chair");
    expect(en.landing.philosophyText.toLowerCase()).toContain("simmer");

    // Turkish tone assertions
    expect(tr.landing.heroTitle.toLowerCase()).toContain("yavaş");
    expect(tr.landing.heroSubtitle.toLowerCase()).toContain("telaşsız");
    expect(tr.landing.getStarted.toLowerCase()).toContain("masaya");
    expect(tr.landing.philosophyText.toLowerCase()).toContain("ağır ateşte");
  });
});
