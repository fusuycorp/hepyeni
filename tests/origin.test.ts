import { afterEach, describe, expect, it } from "bun:test";
import { getRequestOrigin, oauth2RedirectUrl } from "@/lib/pocketbase/session";

describe("Reverse-Proxy Origin Resolution & OAuth URL Protocol", () => {
  const savedAppUrl = process.env.APP_URL;
  const savedTrust = process.env.TRUST_FORWARDED_HEADERS;

  afterEach(() => {
    if (savedAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedAppUrl;
    if (savedTrust === undefined) delete process.env.TRUST_FORWARDED_HEADERS;
    else process.env.TRUST_FORWARDED_HEADERS = savedTrust;
  });

  it("honors x-forwarded-* behind a reverse proxy when forwarded headers are trusted", () => {
    process.env.TRUST_FORWARDED_HEADERS = "1";
    const mockReq = {
      headers: new Headers({
        "x-forwarded-host": "hepyeni.net",
        "x-forwarded-proto": "https",
        host: "0.0.0.0:3000",
      }),
    };

    const origin = getRequestOrigin(mockReq);
    expect(origin).toBe("https://hepyeni.net");
    expect(oauth2RedirectUrl(origin)).toBe("https://hepyeni.net/api/auth/oauth2-callback");
  });

  it("handles custom reverse-proxy port in x-forwarded-host when trusted", () => {
    process.env.TRUST_FORWARDED_HEADERS = "true";
    const mockReq = {
      headers: new Headers({
        "x-forwarded-host": "stage.hepyeni.app:8443",
        "x-forwarded-proto": "https",
        host: "0.0.0.0:3000",
      }),
    };

    const origin = getRequestOrigin(mockReq);
    expect(origin).toBe("https://stage.hepyeni.app:8443");
  });

  it("ignores x-forwarded-* when not trusted and falls back to the validated Host header", () => {
    delete process.env.TRUST_FORWARDED_HEADERS; // default off
    const mockReq = {
      headers: new Headers({
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
        host: "hepyeni.net",
      }),
    };

    // forwarded host is NOT honored; the real Host wins and proto defaults to https
    expect(getRequestOrigin(mockReq)).toBe("https://hepyeni.net");
  });

  it("never outputs 0.0.0.0:3000 when container host header is 0.0.0.0", () => {
    const mockReq = {
      headers: new Headers({
        host: "0.0.0.0:3000",
      }),
    };

    const origin = getRequestOrigin(mockReq);
    expect(origin).not.toContain("0.0.0.0");
  });

  it("preserves localhost in local dev environment without proxy headers", () => {
    const mockReq = {
      headers: new Headers({
        host: "localhost:3000",
      }),
    };

    expect(getRequestOrigin(mockReq)).toBe("https://localhost:3000");
  });

  it("rejects header-injection / malformed hosts instead of echoing them", () => {
    const bad = [
      "hepyeni.net@evil.example",
      "hepyeni.net/path",
      "hepyeni.net?#frag",
      "host with space",
      "",
    ];

    for (const h of bad) {
      const origin = getRequestOrigin({ headers: new Headers({ host: h }) });
      expect(origin).not.toBe(String(h));
      // falls back to a safe localhost dev origin when nothing valid resolves
      expect(origin.startsWith("http://localhost")).toBe(true);
    }
  });

  it("prefers sanitized APP_URL as the authoritative origin even when request headers are present", () => {
    process.env.APP_URL = "https://mycircle.app/";
    const mockReq = {
      headers: new Headers({
        host: "localhost:3000",
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
      }),
    };

    expect(getRequestOrigin(mockReq)).toBe("https://mycircle.app");
    expect(oauth2RedirectUrl()).toBe("https://mycircle.app/api/auth/oauth2-callback");
  });

  it("falls back to sanitized APP_URL if no request headers are passed", () => {
    process.env.APP_URL = "https://mycircle.app/";
    expect(getRequestOrigin()).toBe("https://mycircle.app");
  });
});
