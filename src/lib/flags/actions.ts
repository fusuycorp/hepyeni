"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isKnownFeatureFlag, type FeatureFlagKey } from "./registry";
import { FEATURE_FLAGS_COOKIE_NAME } from "./server";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

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

  try {
    const store = await cookies();
    let currentFlags: Record<string, boolean> = {};

    const existingCookie = store.get(FEATURE_FLAGS_COOKIE_NAME)?.value;
    if (existingCookie) {
      try {
        const parsed = JSON.parse(existingCookie);
        if (typeof parsed === "object" && parsed !== null) {
          currentFlags = parsed;
        }
      } catch {
        // Reset if malformed
      }
    }

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
