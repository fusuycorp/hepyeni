type RateLimitRecord = {
  timestamps: number[];
};

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Sliding window in-memory rate limiter for public endpoints and server actions.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60_000 },
  now = Date.now(),
): RateLimitResult {
  const record = rateLimitStore.get(key) ?? { timestamps: [] };
  const cutoff = now - options.windowMs;
  const recent = record.timestamps.filter((ts) => ts > cutoff);

  if (recent.length >= options.limit) {
    const oldest = recent[0];
    const resetMs = oldest ? Math.max(0, oldest + options.windowMs - now) : options.windowMs;
    return { allowed: false, remaining: 0, resetMs };
  }

  recent.push(now);
  rateLimitStore.set(key, { timestamps: recent });

  // Periodically clean stale keys if store grows
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      const valid = v.timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        rateLimitStore.delete(k);
      } else {
        rateLimitStore.set(k, { timestamps: valid });
      }
    }
  }

  return {
    allowed: true,
    remaining: options.limit - recent.length,
    resetMs: options.windowMs,
  };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}

export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const trustForwarded =
      process.env.TRUST_FORWARDED_HEADERS === "1" ||
      process.env.TRUST_FORWARDED_HEADERS === "true" ||
      process.env.TRUST_FORWARDED_HEADERS === "on";

    if (trustForwarded) {
      const forwarded = h.get("x-forwarded-for");
      if (forwarded) {
        return forwarded.split(",")[0].trim();
      }
      const realIp = h.get("x-real-ip");
      if (realIp) return realIp.trim();
    }
  } catch {
    // outside request context or in unit tests
  }
  return "127.0.0.1";
}
