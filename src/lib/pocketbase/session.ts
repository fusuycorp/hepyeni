import { cookies } from "next/headers";
import PocketBase from "pocketbase";
import type { UsersResponse } from "@/types/pocketbase-types";

const SESSION_COOKIE = "pb_session";
const OAUTH_STATE_COOKIE = "pb_oauth_state";
const OTP_COOKIE = "pb_otp";

export type Session = {
  id: string;
  isAdmin: boolean;
  name: string;
  email: string;
};

export function getPbUrl(): string {
  return (
    process.env.PB_URL ||
    process.env.POCKETBASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "http://pocketbase:8090"
      : "http://127.0.0.1:8090")
  );
}

// Re-verifies the token against PocketBase on every call (authRefresh both
// checks the signature/expiry server-side and returns the live record, not
// a decoded stale JWT payload) — this is what makes a ban take effect on
// the caller's very next request, the same latency NextAuth's database
// sessions gave us, despite PocketBase's tokens being otherwise stateless.
export async function getSessionFromToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;

  const pb = new PocketBase(getPbUrl());
  pb.authStore.save(token, null);


  try {
    const { record } = await pb
      .collection("users")
      .authRefresh<UsersResponse>();
    if (record.bannedAt) return null;
    return {
      id: record.id,
      isAdmin: Boolean(record.isAdmin),
      name: record.name,
      email: record.email,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return getSessionFromToken(store.get(SESSION_COOKIE)?.value);
}

const isProd = process.env.NODE_ENV === "production";

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 5, // matches PocketBase's default 5-day token TTL
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// --- OAuth2 transient state — only lives across the redirect-to-Google ->
// callback round trip, a few minutes at most. ---

export type OAuth2State = {
  provider: "google" | "apple";
  state: string;
  codeVerifier: string;
};

// Must be byte-identical between the redirect-to-Google step and the
// callback step, or the OAuth2 provider rejects the code exchange.
//
// Proxy-contract for host resolution (security boundary):
//  1. APP_URL set  -> it is the single authoritative origin; forwarded and Host
//     headers are ignored so a spoofable header can never steer the redirect.
//  2. TRUST_FORWARDED_HEADERS=1|true|on -> x-forwarded-host / -proto are honored
//     (only for a reverse proxy that overwrites them; never for direct trust of
//     client-supplied values). Lowers the open-redirect / OAuth redirect_uri
//     tampering surface described in the security review.
//  3. default -> the validated Host header wins, proto assumed https.
// In every case the effective host must match a strict host[:port] pattern, and
// 0.0.0.0 / localhost fall through so a container's internal Host can never be
// emitted as a public origin.
// Env is read at call time (like APP_URL below) so tests and config changes take
// effect per call rather than being frozen at module load.
function trustForwardedHeaders(): boolean {
  return ["1", "true", "on"].includes(
    (process.env.TRUST_FORWARDED_HEADERS ?? "").toLowerCase(),
  );
}

// host[:port] allowlist — rejects userinfo (@), paths (/), query/fragment
// (?/#), whitespace, control characters, and other header-injection vectors.
function isValidHost(host: string | null | undefined): host is string {
  return (
    typeof host === "string" &&
    /^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(host)
  );
}

function normalizeProto(proto: string | null | undefined): string {
  return proto === "http" ? "http" : "https";
}

export function getRequestOrigin(req?: {
  headers: { get: (name: string) => string | null };
}): string {
  // 1. APP_URL is authoritative when configured.
  if (process.env.APP_URL && !process.env.APP_URL.includes("0.0.0.0")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  if (req) {
    let host: string | null = null;
    let proto: string | null = null;

    if (trustForwardedHeaders()) {
      host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      proto = req.headers.get("x-forwarded-proto");
    } else {
      // Host only — do not honor forwarded headers unless explicitly trusted.
      host = req.headers.get("host");
      proto = null;
    }

    if (isValidHost(host) && !host.includes("0.0.0.0")) {
      return `${normalizeProto(proto)}://${host}`;
    }
  }

  // 3. Last-resort dev fallback; never reaches a real deployment origin.
  return "http://localhost:3000";
}

export function oauth2RedirectUrl(origin?: string): string {
  const base = origin || getRequestOrigin();
  return new URL("/api/auth/oauth2-callback", base).toString();
}

// OAuth sign-in ENTRY path. PocketBase's provider authURL ends with
// `redirect_uri=` (no value) — the documented pattern is to concatenate the
// redirect URL directly. Routing the origin through getRequestOrigin applies
// the same S6 contract as the callback path (APP_URL authoritative,
// x-forwarded-* only under TRUST_FORWARDED_HEADERS, loopback fallback for dev).
export function buildOAuthInitUrl(
  authURL: string,
  req?: { headers: { get: (name: string) => string | null } },
): string {
  return authURL + oauth2RedirectUrl(getRequestOrigin(req));
}


// --- Email OTP transient state — bridges the "request a code" step and
// the "enter the code" step of the two-step passwordless login form. ---

export type OtpState = { email: string; otpId: string };

export async function setOtpCookie(data: OtpState): Promise<void> {
  const store = await cookies();
  store.set(OTP_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5, // matches PocketBase's default OTP validity window
  });
}

export async function peekOtpCookie(): Promise<OtpState | null> {
  const store = await cookies();
  const raw = store.get(OTP_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpState;
  } catch {
    return null;
  }
}

export async function consumeOtpCookie(): Promise<OtpState | null> {
  const store = await cookies();
  const raw = store.get(OTP_COOKIE)?.value;
  store.delete(OTP_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpState;
  } catch {
    return null;
  }
}

export async function setOAuth2StateCookie(data: OAuth2State): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function consumeOAuth2StateCookie(): Promise<OAuth2State | null> {
  const store = await cookies();
  const raw = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuth2State;
  } catch {
    return null;
  }
}

// --- Pending Group Invite transient state — preserves invite code through login/signup ---

const PENDING_INVITE_COOKIE = "pb_pending_invite";

export async function setPendingInviteCookie(code: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_INVITE_COOKIE, code.trim().toUpperCase(), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function getPendingInviteCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_INVITE_COOKIE)?.value ?? null;
}

export async function consumePendingInviteCookie(): Promise<string | null> {
  const store = await cookies();
  const val = store.get(PENDING_INVITE_COOKIE)?.value ?? null;
  if (val) {
    store.delete(PENDING_INVITE_COOKIE);
  }
  return val;
}

export async function clearPendingInviteCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_INVITE_COOKIE);
}

