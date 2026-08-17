import { describe, expect, it } from "bun:test";
import { getRequestOrigin, oauth2RedirectUrl } from "@/lib/pocketbase/session";

describe("Reverse-Proxy Origin Resolution & OAuth URL Protocol", () => {
  it("resolves public HTTPS domain from x-forwarded-* headers behind reverse proxy", () => {
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

  it("handles custom reverse-proxy port in x-forwarded-host", () => {
    const mockReq = {
      headers: new Headers({
        "x-forwarded-host": "stage.titirek.app:8443",
        "x-forwarded-proto": "https",
        host: "0.0.0.0:3000",
      }),
    };

    const origin = getRequestOrigin(mockReq);
    expect(origin).toBe("https://stage.titirek.app:8443");
    expect(oauth2RedirectUrl(origin)).toBe(
      "https://stage.titirek.app:8443/api/auth/oauth2-callback",
    );
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

    const origin = getRequestOrigin(mockReq);
    expect(origin).toBe("https://localhost:3000");
  });

  it("falls back to sanitized APP_URL if no request headers are passed", () => {
    const originalEnv = process.env.APP_URL;
    try {
      process.env.APP_URL = "https://mycircle.app/";
      const origin = getRequestOrigin();
      expect(origin).toBe("https://mycircle.app");
      expect(oauth2RedirectUrl()).toBe("https://mycircle.app/api/auth/oauth2-callback");
    } finally {
      process.env.APP_URL = originalEnv;
    }
  });
});
