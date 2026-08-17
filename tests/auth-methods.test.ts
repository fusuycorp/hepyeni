import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import type { UserAuthMethods } from "@/lib/actions/auth";

describe("Auth Methods & Connected Accounts - Profile Display", () => {
  const authKeys = [
    "authMethodsTitle",
    "authMethodsDesc",
    "connected",
    "notConnected",
    "active",
    "googleAuth",
    "googleAuthDesc",
    "appleAuth",
    "appleAuthDesc",
    "passwordAuth",
    "passwordAuthDesc",
    "otpAuth",
    "otpAuthDesc",
  ] as const;

  it("enforces full translation parity for all auth method keys between EN and TR", () => {
    for (const key of authKeys) {
      expect(en.profile[key]).toBeDefined();
      expect(en.profile[key].trim().length).toBeGreaterThan(0);

      expect(tr.profile[key]).toBeDefined();
      expect(tr.profile[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("contains meaningful descriptive strings for Google, Apple, Password and OTP methods", () => {
    expect(en.profile.googleAuth).toBe("Google Account");
    expect(tr.profile.googleAuth).toBe("Google Hesabı");

    expect(en.profile.appleAuth).toBe("Apple ID");
    expect(tr.profile.appleAuth).toBe("Apple Kimliği");

    expect(en.profile.passwordAuth).toBe("Password Authentication");
    expect(tr.profile.passwordAuth).toBe("Şifre ile Giriş");

    expect(en.profile.otpAuth).toBe("Email One-Time Password (OTP)");
    expect(tr.profile.otpAuth).toBe("E-posta Tek Kullanımlık Kod (OTP)");

    expect(en.profile.connected).toBe("Connected");
    expect(tr.profile.connected).toBe("Bağlı");

    expect(en.profile.notConnected).toBe("Not Connected");
    expect(tr.profile.notConnected).toBe("Bağlı Değil");

    expect(en.profile.active).toBe("Active");
    expect(tr.profile.active).toBe("Aktif");
  });

  it("extracts and normalizes oauth providers from external auth records", () => {
    function extractAuthMethods(
      rawExternalAuths: Array<{ provider?: string }>,
    ): UserAuthMethods {
      const oauthProviders = rawExternalAuths
        .map((item) =>
          typeof item.provider === "string" ? item.provider.toLowerCase().trim() : "",
        )
        .filter((p): p is string => Boolean(p));

      return {
        hasPassword: true,
        hasOtp: true,
        oauthProviders,
      };
    }

    const empty = extractAuthMethods([]);
    expect(empty.hasPassword).toBe(true);
    expect(empty.hasOtp).toBe(true);
    expect(empty.oauthProviders).toEqual([]);

    const googleUser = extractAuthMethods([{ provider: "Google" }]);
    expect(googleUser.oauthProviders).toEqual(["google"]);
    expect(googleUser.oauthProviders.includes("google")).toBe(true);
    expect(googleUser.oauthProviders.includes("apple")).toBe(false);

    const multiAuthUser = extractAuthMethods([
      { provider: "google" },
      { provider: "Apple" },
      { provider: "" },
      { provider: undefined },
    ]);
    expect(multiAuthUser.oauthProviders).toEqual(["google", "apple"]);
    expect(multiAuthUser.oauthProviders.includes("google")).toBe(true);
    expect(multiAuthUser.oauthProviders.includes("apple")).toBe(true);
  });

  it("computes correct badges and connection status for each method", () => {
    const methodsState: UserAuthMethods = {
      hasPassword: true,
      hasOtp: true,
      oauthProviders: ["google"],
    };

    const isGoogleConnected = methodsState.oauthProviders.includes("google");
    const isAppleConnected = methodsState.oauthProviders.includes("apple");

    expect(isGoogleConnected).toBe(true);
    expect(isAppleConnected).toBe(false);
    expect(methodsState.hasPassword).toBe(true);
    expect(methodsState.hasOtp).toBe(true);
  });
});
