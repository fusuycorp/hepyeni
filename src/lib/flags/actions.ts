"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FEATURE_FLAGS, isKnownFeatureFlag, type FeatureFlagKey } from "./registry";
import { FEATURE_FLAGS_COOKIE_NAME } from "./server";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

function parseExistingFlagsCookie(raw?: string): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

export async function toggleUserFeatureFlag(
  flagKey: FeatureFlagKey,
  enabled: boolean,
): Promise<ActionResult<{ flagKey: FeatureFlagKey; enabled: boolean }>> {
  if (!isKnownFeatureFlag(flagKey)) {
    return {
      success: false,
      error: `Unknown feature flag: ${String(flagKey)}`,
    };
  }

  if (FEATURE_FLAGS[flagKey]?.serverOnly) {
    return {
      success: false,
      error: "This feature flag is managed by the server administrator.",
    };
  }

  try {
    const store = await cookies();
    const currentFlags = parseExistingFlagsCookie(
      store.get(FEATURE_FLAGS_COOKIE_NAME)?.value,
    );

    currentFlags[flagKey] = Boolean(enabled);

    store.set(FEATURE_FLAGS_COOKIE_NAME, JSON.stringify(currentFlags), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year TTL
    });

    revalidatePath("/profile");
    return {
      success: true,
      data: { flagKey, enabled },
    };
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "toggleUserFeatureFlag",
      flagKey,
      enabled,
    });
    return {
      success: false,
      error: "Özellik tercihi kaydedilemedi.",
      traceId: diag.traceId,
    };
  }
}
