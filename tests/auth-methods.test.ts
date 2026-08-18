import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import type { UserAuthMethods } from "@/lib/actions/auth";

// Mirror of the pure mapping inside getUserAuthMethods (src/lib/actions/auth.ts).
// PocketBase's listAuthMethods() reports COLLECTION-level availability; the public
// API never exposes an individual user's password/OTP state. So hasPassword/hasOtp
// are app-level capabilities (is this sign-in method offered at all), NOT a claim
// about a specific account's credentials. This is why they are derived from the
// methods flags rather than hardcoded to true.
type AuthMethodsShape = {
  password?: { enabled: boolean };
  otp?: { enabled: boolean };
};

function deriveUserAuthMethods(
  rawExternalAuths: Array<{ provider?: string }>,
  methods?: AuthMethodsShape,
): UserAuthMethods {
  const oauthProviders = rawExternalAuths
    .map((item) =>
      typeof item.provider === "string" ? item.provider.toLowerCase().trim() : "",
    )
    .filter((p): p is string => Boolean(p));

  return {
    hasPassword: Boolean(methods?.password?.enabled),
    hasOtp: Boolean(methods?.otp?.enabled),
    oauthProviders,
  };
}

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

  it("maps collection-level auth-method availability to hasPassword/hasOtp (not hardcoded)", () => {
    // Both methods enabled
    expect(
      deriveUserAuthMethods([], {
        password: { enabled: true },
        otp: { enabled: true },
      }),
    ).toEqual({ hasPassword: true, hasOtp: true, oauthProviders: [] });

    // Password disabled, OTP enabled (a deployment with OTP-only)
    expect(
      deriveUserAuthMethods([], {
        password: { enabled: false },
        otp: { enabled: true },
      }).hasPassword,
    ).toBe(false);

    // Neither exposed -> fails closed
    expect(deriveUserAuthMethods([], undefined).hasPassword).toBe(false);
    expect(deriveUserAuthMethods([], undefined).hasOtp).toBe(false);
  });

  it("extracts and normalizes oauth providers from external auth records", () => {
    const empty = deriveUserAuthMethods([]);
    expect(empty.oauthProviders).toEqual([]);

    const googleUser = deriveUserAuthMethods([{ provider: "Google" }]);
    expect(googleUser.oauthProviders).toEqual(["google"]);
    expect(googleUser.oauthProviders.includes("google")).toBe(true);
    expect(googleUser.oauthProviders.includes("apple")).toBe(false);

    const multiAuthUser = deriveUserAuthMethods([
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
    // Google connected, password and OTP both offered by the collection
    const methodsState = deriveUserAuthMethods(
      [{ provider: "google" }],
      { password: { enabled: true }, otp: { enabled: true } },
    );

    expect(methodsState.oauthProviders.includes("google")).toBe(true);
    expect(methodsState.oauthProviders.includes("apple")).toBe(false);
    expect(methodsState.hasPassword).toBe(true);
    expect(methodsState.hasOtp).toBe(true);

    // OAuth-only provider list but password auth disabled -> must not claim Active
    const oauthOnlyDeployment = deriveUserAuthMethods(
      [{ provider: "google" }],
      { password: { enabled: false }, otp: { enabled: false } },
    );
    expect(oauthOnlyDeployment.hasPassword).toBe(false);
    expect(oauthOnlyDeployment.hasOtp).toBe(false);
  });
});
