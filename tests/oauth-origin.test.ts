import { afterEach, describe, expect, it } from "bun:test";
import { buildOAuthInitUrl } from "@/lib/pocketbase/session";

// PocketBase's OAuth authURL ends with `redirect_uri=` (no value); the app
// concatenates the callback URL directly. These tests pin the S6 origin
// contract on the sign-in ENTRY path (signInWithOAuth2) so the redirect_uri
// honors APP_URL / TRUST_FORWARDED_HEADERS exactly like the callback path.
const PROVIDER_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=";
const CALLBACK_PATH = "/api/auth/oauth2-callback";

describe("OAuth initiation URL (signInWithOAuth2 entry path)", () => {
  const savedAppUrl = process.env.APP_URL;
  const savedTrust = process.env.TRUST_FORWARDED_HEADERS;

  afterEach(() => {
    if (savedAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedAppUrl;
    if (savedTrust === undefined) delete process.env.TRUST_FORWARDED_HEADERS;
    else process.env.TRUST_FORWARDED_HEADERS = savedTrust;
  });

  it("uses APP_URL as the redirect_uri origin when configured, regardless of headers", () => {
    process.env.APP_URL = "https://mycircle.app/";
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({
        host: "localhost:3000",
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
      }),
    });

    expect(url).toBe(
      `${PROVIDER_AUTH_URL}https://mycircle.app/api/auth/oauth2-callback`,
    );
  });

  it("honors x-forwarded-host for the redirect_uri when TRUST_FORWARDED_HEADERS=1", () => {
    process.env.TRUST_FORWARDED_HEADERS = "1";
    delete process.env.APP_URL;
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({
        host: "0.0.0.0:3000",
        "x-forwarded-host": "hepyeni.net",
        "x-forwarded-proto": "https",
      }),
    });

    expect(url).toBe(
      `${PROVIDER_AUTH_URL}https://hepyeni.net/api/auth/oauth2-callback`,
    );
  });

  it("ignores x-forwarded-host for the redirect_uri when trust flag is absent, falling back to Host", () => {
    process.env.TRUST_FORWARDED_HEADERS = "0";
    delete process.env.APP_URL;
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({
        host: "hepyeni.net",
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
      }),
    });

    expect(url).toBe(
      `${PROVIDER_AUTH_URL}https://hepyeni.net/api/auth/oauth2-callback`,
    );
  });

  it("hostile forwarded host cannot steer the redirect_uri origin under no-trust", () => {
    delete process.env.APP_URL;
    delete process.env.TRUST_FORWARDED_HEADERS;
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({
        host: "mycircle.app",
        "x-forwarded-host": "attacker.example.com",
        "x-forwarded-proto": "http",
      }),
    });

    expect(url).not.toContain("attacker.example.com");
    expect(url).toBe(
      `${PROVIDER_AUTH_URL}https://mycircle.app/api/auth/oauth2-callback`,
    );
  });

  it("keeps the loopback dev fallback as a valid redirect_uri when nothing authoritative resolves", () => {
    delete process.env.APP_URL;
    delete process.env.TRUST_FORWARDED_HEADERS;
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({ host: "0.0.0.0:3000" }),
    });

    // Documented last-resort origin; local PocketBase on :8090 keeps working
    // against it in dev — do NOT block loopback here.
    expect(url).toBe(`${PROVIDER_AUTH_URL}http://localhost:3000${CALLBACK_PATH}`);
  });

  it("preserves a localhost dev host header as the redirect_uri origin", () => {
    delete process.env.APP_URL;
    delete process.env.TRUST_FORWARDED_HEADERS;
    const url = buildOAuthInitUrl(PROVIDER_AUTH_URL, {
      headers: new Headers({ host: "localhost:3000" }),
    });

    expect(url).toBe(
      `${PROVIDER_AUTH_URL}https://localhost:3000${CALLBACK_PATH}`,
    );
  });
});