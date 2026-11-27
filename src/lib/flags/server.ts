import { cookies } from "next/headers";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
} from "./registry";

export const FEATURE_FLAGS_COOKIE_NAME = "hepyeni_flags";

export interface FeatureFlagContext {
  cookies?:
    | Record<string, string>
    | { get: (name: string) => { value?: string } | undefined };
  flags?: Partial<Record<FeatureFlagKey, boolean>>;
  circleSettings?: Partial<Record<FeatureFlagKey, boolean>>;
  group?: {
    guestSettings?: Record<string, unknown>;
    flags?: Partial<Record<FeatureFlagKey, boolean>>;
    [key: string]: unknown;
  };
  userId?: string;
}

function parseFlagBoolean(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") {
    if (val === 1) return true;
    if (val === 0) return false;
    return undefined;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^(true|1|yes|on)$/i.test(trimmed)) return true;
    if (/^(false|0|no|off)$/i.test(trimmed)) return false;
  }
  return undefined;
}

function parseCookieFlags(cookieValue?: string): Partial<Record<FeatureFlagKey, boolean>> {
  if (!cookieValue || typeof cookieValue !== "string") return {};
  try {
    const parsed = JSON.parse(cookieValue);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const sanitized: Partial<Record<FeatureFlagKey, boolean>> = Object.create(null);
    for (const [k, v] of Object.entries(parsed)) {
      const coerced = parseFlagBoolean(v);
      if (coerced !== undefined) {
        sanitized[k as FeatureFlagKey] = coerced;
      }
    }
    return sanitized;
  } catch {
    return {};
  }
}

async function getCookieValue(
  cookieName: string,
  context?: FeatureFlagContext,
): Promise<string | undefined> {
  if (context?.cookies) {
    if (typeof (context.cookies as { get?: unknown }).get === "function") {
      return (
        context.cookies as { get: (name: string) => { value?: string } | undefined }
      ).get(cookieName)?.value;
    }
    return (context.cookies as Record<string, string>)[cookieName];
  }

  try {
    const store = await cookies();
    return store.get(cookieName)?.value;
  } catch {
    // cookies() might fail if called outside Next.js request lifecycle (e.g. in certain unit tests)
    return undefined;
  }
}

function readOwnContextFlag(
  record: Partial<Record<FeatureFlagKey, boolean>> | undefined,
  flagKey: FeatureFlagKey,
): boolean | undefined {
  if (
    record &&
    Object.prototype.hasOwnProperty.call(record, flagKey) &&
    record[flagKey] !== undefined
  ) {
    return Boolean(record[flagKey]);
  }
  return undefined;
}

function resolveSyncFlagOverride(
  flagKey: FeatureFlagKey,
  context?: FeatureFlagContext,
): boolean | undefined {
  // 1. Environment Variable Override (FLAG_ENABLE_*)
  const envVal = process.env[`FLAG_ENABLE_${flagKey.toUpperCase()}`];
  if (envVal !== undefined) {
    const parsedEnv = parseFlagBoolean(envVal);
    if (parsedEnv !== undefined) return parsedEnv;
  }

  // 2. Direct Context Override
  const direct = readOwnContextFlag(context?.flags, flagKey);
  if (direct !== undefined) return direct;

  // 3. Circle / Group Settings Override
  const circle = readOwnContextFlag(context?.circleSettings, flagKey);
  if (circle !== undefined) return circle;

  return readOwnContextFlag(context?.group?.flags, flagKey);
}

async function resolveSingleFlag(
  flagKey: FeatureFlagKey,
  context: FeatureFlagContext | undefined,
  preloadedCookieFlags?: Partial<Record<FeatureFlagKey, boolean>>,
): Promise<boolean> {
  const syncOverride = resolveSyncFlagOverride(flagKey, context);
  if (syncOverride !== undefined) return syncOverride;

  // 4. User Cookie Override (skipped for server-only flags)
  if (!FEATURE_FLAGS[flagKey]?.serverOnly) {
    const cookieFlags =
      preloadedCookieFlags ??
      parseCookieFlags(await getCookieValue(FEATURE_FLAGS_COOKIE_NAME, context));
    if (cookieFlags[flagKey] !== undefined) {
      return Boolean(cookieFlags[flagKey]);
    }

    const individualCookieVal = await getCookieValue(`flag_${flagKey}`, context);
    const parsedCookie = parseFlagBoolean(individualCookieVal);
    if (parsedCookie !== undefined) return parsedCookie;
  }

  // 5. Default Registry Value
  return FEATURE_FLAGS[flagKey]?.defaultEnabled ?? false;
}

export async function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  context?: FeatureFlagContext,
): Promise<boolean> {
  if (!flagKey || typeof flagKey !== "string") {
    return false;
  }
  return resolveSingleFlag(flagKey, context);
}

export async function getFeatureFlags(
  context?: FeatureFlagContext,
): Promise<Record<FeatureFlagKey, boolean>> {
  const result = {} as Record<FeatureFlagKey, boolean>;

  // Read cookies once for efficiency
  const mainCookieVal = await getCookieValue(FEATURE_FLAGS_COOKIE_NAME, context);
  const cookieFlags = parseCookieFlags(mainCookieVal);

  for (const key of FEATURE_FLAG_KEYS) {
    result[key] = await resolveSingleFlag(key, context, cookieFlags);
  }

  return result;
}

export async function requireFeature(
  flagKey: FeatureFlagKey,
  context?: FeatureFlagContext,
): Promise<void> {
  const enabled = await isFeatureEnabled(flagKey, context);
  if (!enabled) {
    throw new Error(`Feature "${flagKey}" is not enabled`);
  }
}
