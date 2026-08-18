"use client";

import React, { createContext, useContext, useMemo } from "react";
import { FEATURE_FLAGS, type FeatureFlagKey } from "./registry";

interface FeatureFlagsContextType {
  flags: Record<FeatureFlagKey, boolean>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null);

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  spoiler_blur: FEATURE_FLAGS.spoiler_blur.defaultEnabled,
  milestone_campfires: FEATURE_FLAGS.milestone_campfires.defaultEnabled,
  data_portability: FEATURE_FLAGS.data_portability.defaultEnabled,
  digital_marginalia: FEATURE_FLAGS.digital_marginalia.defaultEnabled,
  mood_pace_folksonomy: FEATURE_FLAGS.mood_pace_folksonomy.defaultEnabled,
  blind_pick_wheel: FEATURE_FLAGS.blind_pick_wheel.defaultEnabled,
};

export interface FeatureFlagsProviderProps {
  flags?: Partial<Record<FeatureFlagKey, boolean>>;
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>;
  children: React.ReactNode;
}

export function FeatureFlagsProvider({
  flags,
  initialFlags,
  children,
}: FeatureFlagsProviderProps) {
  const mergedFlags = useMemo(() => {
    return {
      ...DEFAULT_FLAGS,
      ...(initialFlags || {}),
      ...(flags || {}),
    };
  }, [flags, initialFlags]);

  const value = useMemo(
    () => ({
      flags: mergedFlags,
    }),
    [mergedFlags],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    return DEFAULT_FLAGS;
  }
  return ctx.flags;
}

export function useFeatureFlag(flagKey: FeatureFlagKey): boolean {
  const flags = useFeatureFlags();
  return flags[flagKey] ?? FEATURE_FLAGS[flagKey]?.defaultEnabled ?? false;
}
