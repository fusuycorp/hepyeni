import { describe, expect, it } from "bun:test";
import { getTranslations, formatRelativeTime, defaultLocale, t } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import type { Locale } from "@/lib/i18n/types";

describe("getTranslations - locale resolution", () => {
  it("returns the Turkish dictionary for 'tr'", () => {
    expect(getTranslations("tr")).toBe(tr);
  });

  it("returns the English dictionary for 'en'", () => {
    expect(getTranslations("en")).toBe(en);
  });

  it("defaults to Turkish when called with no argument", () => {
    expect(getTranslations()).toBe(tr);
  });

  it("falls back to Turkish for an unsupported/unknown locale value", () => {
    // Simulates a corrupted cookie value bypassing the type system.
    expect(getTranslations("fr" as Locale)).toBe(tr);
    expect(getTranslations("" as Locale)).toBe(tr);
  });

  it("exposes defaultLocale as 'tr' and `t` as the Turkish dictionary", () => {
    expect(defaultLocale).toBe("tr");
    expect(t).toBe(tr);
  });
});

// All offsets below are whole-second multiples of 1000ms so that the tiny
// (sub-millisecond) delay between constructing `dateInput` and
// `formatRelativeTime` internally calling `new Date()` can never flip the
// floored second count across a bucket boundary.
function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}

describe("formatRelativeTime - Turkish", () => {
  it("reports 'az önce' for durations under a minute", () => {
    expect(formatRelativeTime(secondsAgo(0), "tr")).toBe("az önce");
    expect(formatRelativeTime(secondsAgo(59), "tr")).toBe("az önce");
  });

  it("reports minutes for durations under an hour", () => {
    expect(formatRelativeTime(secondsAgo(60), "tr")).toBe("1 dk önce");
    expect(formatRelativeTime(secondsAgo(3599), "tr")).toBe("59 dk önce");
  });

  it("reports hours for durations under a day", () => {
    expect(formatRelativeTime(secondsAgo(3600), "tr")).toBe("1 sa önce");
    expect(formatRelativeTime(secondsAgo(86399), "tr")).toBe("23 sa önce");
  });

  it("reports days for durations under a month", () => {
    expect(formatRelativeTime(secondsAgo(86400), "tr")).toBe("1 gün önce");
    expect(formatRelativeTime(secondsAgo(29 * 86400), "tr")).toBe("29 gün önce");
  });

  it("reports months for durations under a year", () => {
    expect(formatRelativeTime(secondsAgo(30 * 86400), "tr")).toBe("1 ay önce");
    expect(formatRelativeTime(secondsAgo(11 * 30 * 86400), "tr")).toBe("11 ay önce");
  });

  it("reports years for durations of a year or more", () => {
    expect(formatRelativeTime(secondsAgo(12 * 30 * 86400), "tr")).toBe("1 yıl önce");
    expect(formatRelativeTime(secondsAgo(2 * 12 * 30 * 86400), "tr")).toBe("2 yıl önce");
  });
});

describe("formatRelativeTime - English", () => {
  it("reports 'just now' for durations under a minute", () => {
    expect(formatRelativeTime(secondsAgo(0), "en")).toBe("just now");
    expect(formatRelativeTime(secondsAgo(59), "en")).toBe("just now");
  });

  it("reports minutes for durations under an hour", () => {
    expect(formatRelativeTime(secondsAgo(60), "en")).toBe("1m ago");
    expect(formatRelativeTime(secondsAgo(3599), "en")).toBe("59m ago");
  });

  it("reports hours for durations under a day", () => {
    expect(formatRelativeTime(secondsAgo(3600), "en")).toBe("1h ago");
    expect(formatRelativeTime(secondsAgo(86399), "en")).toBe("23h ago");
  });

  it("reports days for durations under a month", () => {
    expect(formatRelativeTime(secondsAgo(86400), "en")).toBe("1d ago");
    expect(formatRelativeTime(secondsAgo(29 * 86400), "en")).toBe("29d ago");
  });

  it("reports months for durations under a year", () => {
    expect(formatRelativeTime(secondsAgo(30 * 86400), "en")).toBe("1mo ago");
    expect(formatRelativeTime(secondsAgo(11 * 30 * 86400), "en")).toBe("11mo ago");
  });

  it("reports years for durations of a year or more", () => {
    expect(formatRelativeTime(secondsAgo(12 * 30 * 86400), "en")).toBe("1y ago");
  });
});

describe("formatRelativeTime - edge cases", () => {
  it("defaults to the tr locale when none is passed", () => {
    expect(formatRelativeTime(secondsAgo(0))).toBe("az önce");
  });

  it("accepts an ISO date string in addition to a Date object", () => {
    const iso = secondsAgo(3600).toISOString();
    expect(formatRelativeTime(iso, "en")).toBe("1h ago");
  });

  it("clamps future dates (clock skew) to 'just now' instead of going negative", () => {
    const future = new Date(Date.now() + 60_000);
    expect(formatRelativeTime(future, "en")).toBe("just now");
    expect(formatRelativeTime(future, "tr")).toBe("az önce");
  });
});

describe("dictionary-drain keys (Cluster 5)", () => {
  it("defines short auth-method badge labels in both locales (replaces split hack)", () => {
    // Brand terms are identical across locales; the password label must be translated.
    expect(en.profile.badgeGoogle).toBe("Google");
    expect(tr.profile.badgeGoogle).toBe("Google");
    expect(en.profile.badgeApple).toBe("Apple");
    expect(tr.profile.badgeApple).toBe("Apple");
    expect(en.profile.badgeOtp).toBe("OTP");
    expect(tr.profile.badgeOtp).toBe("OTP");
    expect(en.profile.badgePassword).toBe("Password");
    expect(tr.profile.badgePassword).toBe("Şifre");
    expect(tr.profile.badgePassword).not.toBe(tr.profile.passwordAuth);
    expect(en.profile.badgePassword).not.toBe(en.profile.passwordAuth);
  });

  it("defines the landing media-shelf and preview note keys in both locales", () => {
    const landingNoteKeys = [
      "mediaShelfNoteBook",
      "mediaShelfNoteMovie",
      "mediaShelfNoteTv",
      "mediaShelfNoteMusic",
      "mediaShelfNotePodcast",
      "previewCircleName",
      "customMediaDesc",
      "customBadge",
    ] as const;
    for (const key of landingNoteKeys) {
      expect(en.landing[key].trim().length).toBeGreaterThan(0);
      expect(tr.landing[key].trim().length).toBeGreaterThan(0);
      expect(typeof en.landing[key]).toBe("string");
      expect(typeof tr.landing[key]).toBe("string");
    }
  });

  it("keeps the translated password badge distinct from the long auth label", () => {
    // Regression guard: the old hack was translations.passwordAuth.split(" ")[0].
    expect(tr.profile.badgePassword.split(" ").length).toBe(1);
  });
});
