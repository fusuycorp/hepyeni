import { beforeEach, describe, expect, it } from "bun:test";
import { checkRateLimit, resetRateLimits, getClientIp } from "@/lib/rate-limit";

describe("Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests under the limit", () => {
    const res1 = checkRateLimit("test-ip", { limit: 5, windowMs: 60_000 }, 1000);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(4);

    const res2 = checkRateLimit("test-ip", { limit: 5, windowMs: 60_000 }, 2000);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(3);
  });

  it("blocks requests that exceed the limit", () => {
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit("test-key", { limit: 5, windowMs: 60_000 }, 1000 + i);
      expect(res.allowed).toBe(true);
    }

    const blocked = checkRateLimit("test-key", { limit: 5, windowMs: 60_000 }, 1010);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets limits when window slides past old timestamps", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("test-slide", { limit: 3, windowMs: 10_000 }, 1000 + i);
    }

    // Blocked within window
    expect(checkRateLimit("test-slide", { limit: 3, windowMs: 10_000 }, 5000).allowed).toBe(false);

    // Allowed after window expires
    const allowed = checkRateLimit("test-slide", { limit: 3, windowMs: 10_000 }, 15000);
    expect(allowed.allowed).toBe(true);
  });

  it("handles getClientIp gracefully outside request scope", async () => {
    const ip = await getClientIp();
    expect(typeof ip).toBe("string");
    expect(ip.length).toBeGreaterThan(0);
  });
});
