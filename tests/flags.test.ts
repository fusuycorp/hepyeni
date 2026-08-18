import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  isKnownFeatureFlag,
  type FeatureFlagKey,
} from "@/lib/flags/registry";
import {
  isFeatureEnabled,
  getFeatureFlags,
  requireFeature,
  FEATURE_FLAGS_COOKIE_NAME,
} from "@/lib/flags/server";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Titirek Labs Feature Flag Engine", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars related to feature flags
    for (const key of FEATURE_FLAG_KEYS) {
      delete process.env[`FLAG_ENABLE_${key.toUpperCase()}`];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Registry & Definition Validation", () => {
    it("registers all required experimental flags", () => {
      const requiredFlags: FeatureFlagKey[] = [
        "data_portability",
        "spoiler_blur",
        "milestone_campfires",
        "digital_marginalia",
        "mood_pace_folksonomy",
        "blind_pick_wheel",
      ];

      for (const flag of requiredFlags) {
        expect(FEATURE_FLAGS[flag]).toBeDefined();
        expect(FEATURE_FLAGS[flag].key).toBe(flag);
        expect(typeof FEATURE_FLAGS[flag].defaultEnabled).toBe("boolean");
        expect(["alpha", "beta", "experimental"]).toContain(
          FEATURE_FLAGS[flag].stage,
        );
      }

      expect(FEATURE_FLAG_KEYS.length).toBe(6);
    });

    it("correctly identifies known vs unknown feature flags", () => {
      expect(isKnownFeatureFlag("spoiler_blur")).toBe(true);
      expect(isKnownFeatureFlag("milestone_campfires")).toBe(true);
      expect(isKnownFeatureFlag("data_portability")).toBe(true);
      expect(isKnownFeatureFlag("non_existent_flag")).toBe(false);
      expect(isKnownFeatureFlag("")).toBe(false);
    });

    it("has appropriate default enabled states", () => {
      expect(FEATURE_FLAGS.spoiler_blur.defaultEnabled).toBe(true);
      expect(FEATURE_FLAGS.milestone_campfires.defaultEnabled).toBe(true);
      expect(FEATURE_FLAGS.data_portability.defaultEnabled).toBe(false);
      expect(FEATURE_FLAGS.digital_marginalia.defaultEnabled).toBe(false);
      expect(FEATURE_FLAGS.mood_pace_folksonomy.defaultEnabled).toBe(false);
      expect(FEATURE_FLAGS.blind_pick_wheel.defaultEnabled).toBe(false);
    });
  });

  describe("Resolution Priority & Override Hierarchy", () => {
    it("prioritizes environment variables over all other sources", async () => {
      process.env.FLAG_ENABLE_DATA_PORTABILITY = "true";

      // Even with context flags or cookies set to false, env true wins
      const enabled = await isFeatureEnabled("data_portability", {
        flags: { data_portability: false },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ data_portability: false }),
        },
      });

      expect(enabled).toBe(true);
    });

    it("supports various truthy and falsy env representations", async () => {
      process.env.FLAG_ENABLE_BLIND_PICK_WHEEL = "1";
      expect(await isFeatureEnabled("blind_pick_wheel")).toBe(true);

      process.env.FLAG_ENABLE_BLIND_PICK_WHEEL = "yes";
      expect(await isFeatureEnabled("blind_pick_wheel")).toBe(true);

      process.env.FLAG_ENABLE_BLIND_PICK_WHEEL = "on";
      expect(await isFeatureEnabled("blind_pick_wheel")).toBe(true);

      process.env.FLAG_ENABLE_SPOILER_BLUR = "false";
      expect(await isFeatureEnabled("spoiler_blur")).toBe(false);

      process.env.FLAG_ENABLE_SPOILER_BLUR = "0";
      expect(await isFeatureEnabled("spoiler_blur")).toBe(false);

      process.env.FLAG_ENABLE_SPOILER_BLUR = "off";
      expect(await isFeatureEnabled("spoiler_blur")).toBe(false);
    });

    it("respects direct context override when no env var exists", async () => {
      const enabled = await isFeatureEnabled("data_portability", {
        flags: { data_portability: true },
      });
      expect(enabled).toBe(true);

      const disabled = await isFeatureEnabled("spoiler_blur", {
        flags: { spoiler_blur: false },
      });
      expect(disabled).toBe(false);
    });

    it("respects circle and group settings overrides", async () => {
      const fromCircle = await isFeatureEnabled("digital_marginalia", {
        circleSettings: { digital_marginalia: true },
      });
      expect(fromCircle).toBe(true);

      const fromGroup = await isFeatureEnabled("mood_pace_folksonomy", {
        group: { flags: { mood_pace_folksonomy: true } },
      });
      expect(fromGroup).toBe(true);
    });

    it("reads and parses JSON feature flags from cookies", async () => {
      const context = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({
            data_portability: true,
            spoiler_blur: false,
          }),
        },
      };

      expect(await isFeatureEnabled("data_portability", context)).toBe(true);
      expect(await isFeatureEnabled("spoiler_blur", context)).toBe(false);
      // Unspecified flag falls back to default
      expect(await isFeatureEnabled("milestone_campfires", context)).toBe(true);
    });

    it("falls back to default registry values when no overrides are present", async () => {
      expect(await isFeatureEnabled("spoiler_blur", { cookies: {} })).toBe(true);
      expect(await isFeatureEnabled("milestone_campfires", { cookies: {} })).toBe(true);
      expect(await isFeatureEnabled("data_portability", { cookies: {} })).toBe(false);
      expect(await isFeatureEnabled("digital_marginalia", { cookies: {} })).toBe(false);
    });
  });

  describe("getFeatureFlags & requireFeature", () => {
    it("returns an exhaustive map of all flags with getFeatureFlags", async () => {
      const context = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({
            data_portability: true,
          }),
        },
      };

      const flags = await getFeatureFlags(context);
      expect(Object.keys(flags).sort()).toEqual(FEATURE_FLAG_KEYS.sort());
      expect(flags.data_portability).toBe(true);
      expect(flags.spoiler_blur).toBe(true);
      expect(flags.blind_pick_wheel).toBe(false);
    });

    it("requireFeature passes when feature is enabled", async () => {
      await expect(
        requireFeature("spoiler_blur", { flags: { spoiler_blur: true } }),
      ).resolves.toBeUndefined();
    });

    it("requireFeature throws an error when feature is disabled", async () => {
      await expect(
        requireFeature("data_portability", { flags: { data_portability: false } }),
      ).rejects.toThrow('Feature "data_portability" is not enabled');
    });
  });

  describe("i18n Translation Completeness for Labs", () => {
    it("contains all flag translations in EN and TR", () => {
      for (const key of FEATURE_FLAG_KEYS) {
        expect(en.labs.flags[key]).toBeDefined();
        expect(en.labs.flags[key].name.length).toBeGreaterThan(0);
        expect(en.labs.flags[key].desc.length).toBeGreaterThan(0);

        expect(tr.labs.flags[key]).toBeDefined();
        expect(tr.labs.flags[key].name.length).toBeGreaterThan(0);
        expect(tr.labs.flags[key].desc.length).toBeGreaterThan(0);
      }
    });
  });
});
