export type FeatureFlagKey =
  | "data_portability"
  | "spoiler_blur"
  | "milestone_campfires"
  | "digital_marginalia"
  | "mood_pace_folksonomy"
  | "blind_pick_wheel";

export type FeatureFlagStage = "alpha" | "beta" | "experimental";

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  defaultEnabled: boolean;
  stage: FeatureFlagStage;
}

export const FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  spoiler_blur: {
    key: "spoiler_blur",
    defaultEnabled: true,
    stage: "beta",
  },
  milestone_campfires: {
    key: "milestone_campfires",
    defaultEnabled: true,
    stage: "beta",
  },
  data_portability: {
    key: "data_portability",
    defaultEnabled: false,
    stage: "alpha",
  },
  digital_marginalia: {
    key: "digital_marginalia",
    defaultEnabled: false,
    stage: "experimental",
  },
  mood_pace_folksonomy: {
    key: "mood_pace_folksonomy",
    defaultEnabled: false,
    stage: "experimental",
  },
  blind_pick_wheel: {
    key: "blind_pick_wheel",
    defaultEnabled: false,
    stage: "experimental",
  },
} as const;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

export function isKnownFeatureFlag(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key);
}
