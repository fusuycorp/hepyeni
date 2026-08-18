import { cookies } from "next/headers";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
} from "./registry";

export const FEATURE_FLAGS_COOKIE_NAME = "titirek_flags";

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

function parseCookieFlags(cookieValue?: string): Partial<Record<FeatureFlagKey, boolean>> {
  if (!cookieValue) return {};
  try {
    const parsed = JSON.parse(cookieValue);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Partial<Record<FeatureFlagKey, boolean>>;
    }
  } catch {
    // Ignore invalid JSON cookie
  }
  return {};
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

export async function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  context?: FeatureFlagContext,
): Promise<boolean> {
  // 1. Environment Variable Override (FLAG_ENABLE_*)
  const envKey = `FLAG_ENABLE_${flagKey.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    if (/^(true|1|yes|on)$/i.test(envVal.trim())) return true;
    if (/^(false|0|no|off)$/i.test(envVal.trim())) return false;
  }

  // 2. Direct Context Override
  if (context?.flags && context.flags[flagKey] !== undefined) {
    return Boolean(context.flags[flagKey]);
  }

  // 3. Circle / Group Settings Override
  if (context?.circleSettings && context.circleSettings[flagKey] !== undefined) {
    return Boolean(context.circleSettings[flagKey]);
  }
  if (context?.group?.flags && context.group.flags[flagKey] !== undefined) {
    return Boolean(context.group.flags[flagKey]);
  }

  // 4. User Cookie Override
  const mainCookieVal = await getCookieValue(FEATURE_FLAGS_COOKIE_NAME, context);
  const cookieFlags = parseCookieFlags(mainCookieVal);
  if (cookieFlags[flagKey] !== undefined) {
    return Boolean(cookieFlags[flagKey]);
  }

  const individualCookieVal = await getCookieValue(`flag_${flagKey}`, context);
  if (individualCookieVal !== undefined) {
    if (/^(true|1|yes|on)$/i.test(individualCookieVal.trim())) return true;
    if (/^(false|0|no|off)$/i.test(individualCookieVal.trim())) return false;
  }

  // 5. Default Registry Value
  return FEATURE_FLAGS[flagKey]?.defaultEnabled ?? false;
}

export async function getFeatureFlags(
  context?: FeatureFlagContext,
): Promise<Record<FeatureFlagKey, boolean>> {
  const result = {} as Record<FeatureFlagKey, boolean>;

  // Read cookies once for efficiency
  const mainCookieVal = await getCookieValue(FEATURE_FLAGS_COOKIE_NAME, context);
  const cookieFlags = parseCookieFlags(mainCookieVal);

  for (const key of FEATURE_FLAG_KEYS) {
    // 1. Environment Variable
    const envKey = `FLAG_ENABLE_${key.toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal !== undefined) {
      if (/^(true|1|yes|on)$/i.test(envVal.trim())) {
        result[key] = true;
        continue;
      }
      if (/^(false|0|no|off)$/i.test(envVal.trim())) {
        result[key] = false;
        continue;
      }
    }

    // 2. Context flags
    if (context?.flags && context.flags[key] !== undefined) {
      result[key] = Boolean(context.flags[key]);
      continue;
    }

    // 3. Circle / Group
    if (context?.circleSettings && context.circleSettings[key] !== undefined) {
      result[key] = Boolean(context.circleSettings[key]);
      continue;
    }
    if (context?.group?.flags && context.group.flags[key] !== undefined) {
      result[key] = Boolean(context.group.flags[key]);
      continue;
    }

    // 4. Cookie
    if (cookieFlags[key] !== undefined) {
      result[key] = Boolean(cookieFlags[key]);
      continue;
    }

    // 5. Default
    result[key] = FEATURE_FLAGS[key]?.defaultEnabled ?? false;
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
