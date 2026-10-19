import { trustForwardedHeaders } from "@/lib/pocketbase/session";

type RateLimitRecord = {
  timestamps: number[];
  windowMs: number;
};

const MAX_STORE_KEYS = 5000;
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
  const record = rateLimitStore.get(key) ?? {
    timestamps: [],
    windowMs: options.windowMs,
  };
  const cutoff = now - options.windowMs;
  const recent = record.timestamps.filter((ts) => ts > cutoff);

  if (recent.length >= options.limit) {
    const oldest = recent[0];
    const resetMs = oldest ? Math.max(0, oldest + options.windowMs - now) : options.windowMs;
    return { allowed: false, remaining: 0, resetMs };
  }

  // Periodically clean stale keys if store grows using each entry's own windowMs
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      const entryCutoff = now - v.windowMs;
      const valid = v.timestamps.filter((t) => t > entryCutoff);
      if (valid.length === 0) {
        rateLimitStore.delete(k);
      } else {
        rateLimitStore.set(k, { timestamps: valid, windowMs: v.windowMs });
      }
    }
  }

  if (!rateLimitStore.has(key) && rateLimitStore.size >= MAX_STORE_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitStore.delete(oldestKey);
    }
  }

  recent.push(now);
  rateLimitStore.set(key, { timestamps: recent, windowMs: options.windowMs });

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
    if (trustForwardedHeaders()) {
      const realIp = h.get("x-real-ip")?.trim();
      if (realIp) return realIp;

      const forwarded = h.get("x-forwarded-for");
      if (forwarded) {
        const parts = forwarded
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        const hop = parts[parts.length - 1];
        if (hop) return hop;
      }
    }
  } catch {
    // outside request context or in unit tests
  }

  // No trustworthy client identity is available. Returning one shared constant
  // (previously "127.0.0.1") collapsed every anonymous caller into a SINGLE
  // bucket, so 60 requests/min from one client exhausted the limit for the
  // entire public internet — an attacker could blank the public invite page
  // for everyone. A non-colliding key per call is deliberately inert rather
  // than harmful: it cannot exhaust another caller's budget, it fails closed
  // for shared-bucket abuse, and it makes the misconfiguration loud.
  //
  // Limiting is only meaningful behind a proxy that overwrites
  // x-forwarded-for and is explicitly trusted via TRUST_FORWARDED_HEADERS=1
  // (see .env.example) — without it, no per-client identity exists to key on.
  warnMissingTrustedIdentityOnce();
  return `unknown:${crypto.randomUUID()}`;
}

let warnedMissingTrustedIdentity = false;

function warnMissingTrustedIdentityOnce(): void {
  if (warnedMissingTrustedIdentity) return;
  warnedMissingTrustedIdentity = true;
  // Logged once per process: this runs on public request paths, so repeating
  // it per request would itself be a log-volume amplification vector.
  console.warn(
    "[rate-limit] TRUST_FORWARDED_HEADERS is not enabled, so no trustworthy " +
      "client identity is available and per-client rate limiting is INACTIVE. " +
      "Set TRUST_FORWARDED_HEADERS=1 behind a reverse proxy that overwrites " +
      "x-forwarded-for to enable it.",
  );
}
