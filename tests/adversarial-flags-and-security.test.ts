import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  isFeatureEnabled,
  getFeatureFlags,
  requireFeature,
  FEATURE_FLAGS_COOKIE_NAME,
} from "@/lib/flags/server";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
} from "@/lib/flags/registry";
import { voteRecordId } from "@/lib/pocketbase/vote-id";

describe("Adversarial Test Suite 2: Feature Flags Engine & Cryptographic Vote IDs", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of FEATURE_FLAG_KEYS) {
      delete process.env[`FLAG_ENABLE_${key.toUpperCase()}`];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Cookie Tampering & Malicious Payload Fuzzing", () => {
    it("neutralizes prototype pollution payloads without polluting Object.prototype or altering flags", async () => {
      const maliciousCookie = JSON.stringify({
        __proto__: { data_portability: true, digital_marginalia: true },
        constructor: { prototype: { blind_pick_wheel: true } },
      });

      const context = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: maliciousCookie,
        },
      };

      // Ensure global Object.prototype was NOT polluted
      expect((Object.prototype as unknown as Record<string, unknown>).data_portability).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>).digital_marginalia).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>).blind_pick_wheel).toBeUndefined();

      // Ensure default values are respected because prototype injected keys are ignored
      const dataPortability = await isFeatureEnabled("data_portability", context);
      expect(dataPortability).toBe(false);

      const blindPick = await isFeatureEnabled("blind_pick_wheel", context);
      expect(blindPick).toBe(false);
    });

    it("handles non-object and array JSON cookie payloads safely", async () => {
      const arrayCookieContext = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify(["data_portability", "spoiler_blur"]),
        },
      };

      // Array cookies should be safely ignored and fall back to registry defaults
      expect(await isFeatureEnabled("data_portability", arrayCookieContext)).toBe(false);
      expect(await isFeatureEnabled("spoiler_blur", arrayCookieContext)).toBe(true);

      const numberCookieContext = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: "123456789",
        },
      };
      expect(await isFeatureEnabled("data_portability", numberCookieContext)).toBe(false);
    });

    it("correctly parses stringified boolean values and falsy string representations in cookies", async () => {
      const stringContext = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({
            data_portability: "true",
            spoiler_blur: "false",
            blind_pick_wheel: "0",
            digital_marginalia: "yes",
          }),
        },
      };

      expect(await isFeatureEnabled("data_portability", stringContext)).toBe(true);
      expect(await isFeatureEnabled("spoiler_blur", stringContext)).toBe(false);
      expect(await isFeatureEnabled("blind_pick_wheel", stringContext)).toBe(false);
      expect(await isFeatureEnabled("digital_marginalia", stringContext)).toBe(true);
    });

    it("handles massive 1MB cookie string payload without crashing or timing out", async () => {
      // Create a massive payload with thousands of junk keys
      const hugeObject: Record<string, string> = {};
      for (let i = 0; i < 50000; i++) {
        hugeObject[`junk_key_${i}`] = "some_random_payload_value";
      }
      hugeObject.data_portability = "true";

      const hugeJson = JSON.stringify(hugeObject);
      expect(hugeJson.length).toBeGreaterThan(1_000_000); // > 1MB

      const context = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: hugeJson,
        },
      };

      const start = performance.now();
      const enabled = await isFeatureEnabled("data_portability", context);
      const duration = performance.now() - start;

      expect(enabled).toBe(true);
      expect(duration).toBeLessThan(500); // Sub-500ms even for 1MB JSON parse
    });

    it("safely handles corrupted, truncated, and binary cookie values", async () => {
      const corruptedPayloads = [
        "{{{{invalid-json",
        "\x00\x01\x02\x03\xFF\xFE",
        '{"data_portability": true', // truncated
        "undefined",
        "NaN",
        "null",
      ];

      for (const payload of corruptedPayloads) {
        const ctx = { cookies: { [FEATURE_FLAGS_COOKIE_NAME]: payload } };
        expect(await isFeatureEnabled("data_portability", ctx)).toBe(false);
        expect(await isFeatureEnabled("spoiler_blur", ctx)).toBe(true);
      }
    });
  });

  describe("Exhaustive 5-Layer Precedence Collision Matrix", () => {
    it("Layer 1 (Env) overrides Layer 2 (Context), Layer 3 (Circle), Layer 4 (Cookie), and Layer 5 (Default)", async () => {
      // Env says false
      process.env.FLAG_ENABLE_SPOILER_BLUR = "false";

      const context = {
        flags: { spoiler_blur: true },
        circleSettings: { spoiler_blur: true },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ spoiler_blur: true }),
        },
      };

      // Env false MUST win even though all lower layers are true
      expect(await isFeatureEnabled("spoiler_blur", context)).toBe(false);

      // Env says true
      process.env.FLAG_ENABLE_DATA_PORTABILITY = "true";
      const disabledContext = {
        flags: { data_portability: false },
        circleSettings: { data_portability: false },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ data_portability: false }),
        },
      };
      // Env true MUST win
      expect(await isFeatureEnabled("data_portability", disabledContext)).toBe(true);
    });

    it("Layer 2 (Direct Context) overrides Layer 3 (Circle), Layer 4 (Cookie), and Layer 5 (Default)", async () => {
      const context = {
        flags: { data_portability: true },
        circleSettings: { data_portability: false },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ data_portability: false }),
        },
      };

      expect(await isFeatureEnabled("data_portability", context)).toBe(true);

      const disableContext = {
        flags: { spoiler_blur: false },
        circleSettings: { spoiler_blur: true },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ spoiler_blur: true }),
        },
      };
      expect(await isFeatureEnabled("spoiler_blur", disableContext)).toBe(false);
    });

    it("Layer 3 (Circle/Group Settings) overrides Layer 4 (Cookie) and Layer 5 (Default)", async () => {
      const fromCircle = {
        circleSettings: { digital_marginalia: true },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ digital_marginalia: false }),
        },
      };
      expect(await isFeatureEnabled("digital_marginalia", fromCircle)).toBe(true);

      const fromGroup = {
        group: { flags: { digital_marginalia: true } },
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ digital_marginalia: false }),
        },
      };
      expect(await isFeatureEnabled("digital_marginalia", fromGroup)).toBe(true);
    });

    it("Layer 4 (User Cookie) overrides Layer 5 (Registry Default)", async () => {
      // Default for data_portability is false
      const enableViaCookie = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ data_portability: true }),
        },
      };
      expect(await isFeatureEnabled("data_portability", enableViaCookie)).toBe(true);

      // Default for spoiler_blur is true
      const disableViaCookie = {
        cookies: {
          [FEATURE_FLAGS_COOKIE_NAME]: JSON.stringify({ spoiler_blur: false }),
        },
      };
      expect(await isFeatureEnabled("spoiler_blur", disableViaCookie)).toBe(false);
    });

    it("Layer 5 (Registry Default) serves as fallback when all higher layers are unset", async () => {
      expect(await isFeatureEnabled("spoiler_blur")).toBe(FEATURE_FLAGS.spoiler_blur.defaultEnabled);
      expect(await isFeatureEnabled("data_portability")).toBe(FEATURE_FLAGS.data_portability.defaultEnabled);
      expect(await isFeatureEnabled("digital_marginalia")).toBe(FEATURE_FLAGS.digital_marginalia.defaultEnabled);
      expect(await isFeatureEnabled("blind_pick_wheel")).toBe(FEATURE_FLAGS.blind_pick_wheel.defaultEnabled);
    });
  });

  describe("Invalid Keys & requireFeature Security Checks", () => {
    it("safely handles non-existent or invalid flag keys without throwing", async () => {
      expect(await isFeatureEnabled("non_existent_flag" as FeatureFlagKey)).toBe(false);
      expect(await isFeatureEnabled("" as FeatureFlagKey)).toBe(false);
      expect(await isFeatureEnabled(null as unknown as FeatureFlagKey)).toBe(false);
      expect(await isFeatureEnabled(undefined as unknown as FeatureFlagKey)).toBe(false);
    });

    it("requireFeature throws an explicit error when flag is disabled or invalid", async () => {
      await expect(
        requireFeature("data_portability", { flags: { data_portability: false } }),
      ).rejects.toThrow('Feature "data_portability" is not enabled');

      await expect(
        requireFeature("non_existent_feature" as FeatureFlagKey),
      ).rejects.toThrow('Feature "non_existent_feature" is not enabled');
    });

    it("requireFeature resolves cleanly when feature is enabled", async () => {
      await expect(
        requireFeature("spoiler_blur", { flags: { spoiler_blur: true } }),
      ).resolves.toBeUndefined();
    });

    it("getFeatureFlags returns a complete snapshot without throwing on malicious context", async () => {
      const flags = await getFeatureFlags({
        cookies: { [FEATURE_FLAGS_COOKIE_NAME]: '{"__proto__": {"hack": true}}' },
      });
      for (const key of FEATURE_FLAG_KEYS) {
        expect(typeof flags[key]).toBe("boolean");
      }
    });
  });

  describe("Adversarial Testing: voteRecordId Collision Resistance & Cryptographic Stability", () => {
    it("guarantees 100% collision resistance across 10,000 distinct (titleId, userId) pairs", async () => {
      const sampleSize = 10000;
      const generatedIds = new Set<string>();
      const promises: Promise<string>[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const titleId = `title_${i}_${(i * 7919) % 65536}`;
        const userId = `user_${(i * 104729) % 65536}_${i % 100}`;
        promises.push(voteRecordId(titleId, userId));
      }

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const id = results[i];
        expect(id).toHaveLength(15);
        expect(id).toMatch(/^[a-z0-9]{15}$/);
        generatedIds.add(id);
      }

      // Exactly 10,000 unique IDs produced (zero collisions)
      expect(generatedIds.size).toBe(sampleSize);
    });

    it("is strictly idempotent over 100 consecutive invocations with the same inputs", async () => {
      const titleId = "fixed_title_id_abc";
      const userId = "fixed_user_id_xyz";
      const baseline = await voteRecordId(titleId, userId);

      for (let i = 0; i < 100; i++) {
        const current = await voteRecordId(titleId, userId);
        expect(current).toBe(baseline);
      }
    });

    it("strictly differentiates argument order for symmetric IDs", async () => {
      const idForward = await voteRecordId("alpha123", "beta456");
      const idReverse = await voteRecordId("beta456", "alpha123");
      expect(idForward).not.toBe(idReverse);
    });

    it("handles complex Unicode, Turkish diacritics, emojis, and massive 10,000-char strings safely", async () => {
      // Turkish special characters
      const trId = await voteRecordId("kitap_şeker_ğüçıö_İÖÜÇŞĞ", "kullanıcı_yöneticisi_123");
      expect(trId).toHaveLength(15);
      expect(trId).toMatch(/^[a-z0-9]{15}$/);

      // Emojis and Astral Symbols
      const emojiId = await voteRecordId("📚🔥✨🚀", "👤🎉");
      expect(emojiId).toHaveLength(15);
      expect(emojiId).toMatch(/^[a-z0-9]{15}$/);

      // Right-to-left and bidirectional characters
      const bidiId = await voteRecordId("عنوان_الكتاب_\u202E", "المستخدم_42");
      expect(bidiId).toHaveLength(15);
      expect(bidiId).toMatch(/^[a-z0-9]{15}$/);

      // Massive 10,000-character input
      const hugeTitle = "T".repeat(10000);
      const hugeUser = "U".repeat(10000);
      const hugeId = await voteRecordId(hugeTitle, hugeUser);
      expect(hugeId).toHaveLength(15);
      expect(hugeId).toMatch(/^[a-z0-9]{15}$/);
    });
  });
});
