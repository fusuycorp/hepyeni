import { describe, expect, it } from "bun:test";
import {
  sampleWheelCandidates,
  pickWheelWinner,
  calculateWheelRotation,
  shouldRedactProposalIdentity,
  redactProposedTitles,
} from "@/lib/moods";

describe("Adversarial Test Suite 3: Decision Wheel Physics & Proposal Identity Redaction", () => {
  describe("Decision Wheel Statistical Fuzzing (100,000 Iterations)", () => {
    it("guarantees fair uniform distribution across 2 candidates over 100,000 iterations without out-of-bounds", () => {
      const candidates = [
        { id: "c1", title: "Book Alpha", score: 10 },
        { id: "c2", title: "Book Beta", score: 5 },
      ];
      const counts = [0, 0];
      const iterations = 100000;

      for (let i = 0; i < iterations; i++) {
        const pick = pickWheelWinner(candidates);
        expect(pick).not.toBeNull();
        if (pick) {
          expect(pick.index).toBeGreaterThanOrEqual(0);
          expect(pick.index).toBeLessThan(2);
          expect(pick.winner.id).toBe(candidates[pick.index].id);
          counts[pick.index]++;
        }
      }

      // Expected ~50,000 each. 6-sigma bounds: [47000, 53000]
      expect(counts[0]).toBeGreaterThan(47000);
      expect(counts[0]).toBeLessThan(53000);
      expect(counts[1]).toBeGreaterThan(47000);
      expect(counts[1]).toBeLessThan(53000);
    });

    it("guarantees fair uniform distribution across 4 candidates over 100,000 iterations", () => {
      const candidates = [
        { id: "c1", title: "Item 1" },
        { id: "c2", title: "Item 2" },
        { id: "c3", title: "Item 3" },
        { id: "c4", title: "Item 4" },
      ];
      const counts = [0, 0, 0, 0];
      const iterations = 100000;

      for (let i = 0; i < iterations; i++) {
        const pick = pickWheelWinner(candidates);
        if (pick) {
          counts[pick.index]++;
        }
      }

      // Expected ~25,000 each. Bounds: [23000, 27000]
      for (let i = 0; i < 4; i++) {
        expect(counts[i]).toBeGreaterThan(23000);
        expect(counts[i]).toBeLessThan(27000);
      }
    });

    it("guarantees fair uniform distribution across 8 candidates over 100,000 iterations", () => {
      const candidates = Array.from({ length: 8 }, (_, idx) => ({
        id: `candidate_${idx}`,
        title: `Candidate ${idx}`,
        score: idx,
      }));
      const counts = new Array(8).fill(0);
      const iterations = 100000;

      for (let i = 0; i < iterations; i++) {
        const pick = pickWheelWinner(candidates);
        if (pick) {
          counts[pick.index]++;
        }
      }

      // Expected ~12,500 each. Bounds: [11000, 14000]
      for (let i = 0; i < 8; i++) {
        expect(counts[i]).toBeGreaterThan(11000);
        expect(counts[i]).toBeLessThan(14000);
      }
    });
  });

  describe("Decision Wheel Edge Cases & Candidate Sampling", () => {
    it("handles 0 candidates safely without crashing", () => {
      expect(sampleWheelCandidates([])).toEqual([]);
      expect(sampleWheelCandidates(null as unknown as [])).toEqual([]);
      expect(sampleWheelCandidates(undefined as unknown as [])).toEqual([]);

      expect(pickWheelWinner([])).toBeNull();
      expect(pickWheelWinner(null as unknown as [])).toBeNull();
      expect(pickWheelWinner(undefined as unknown as [])).toBeNull();
    });

    it("handles exactly 1 candidate safely", () => {
      const single = [{ id: "solo", title: "Solo Candidate", score: 42 }];
      const sampled = sampleWheelCandidates(single, 8);
      expect(sampled).toHaveLength(1);
      expect(sampled[0].id).toBe("solo");

      const pick = pickWheelWinner(single);
      expect(pick).toEqual({ winner: single[0], index: 0 });
    });

    it("scales smoothly to 1,000 candidate items and stably sorts top scores", () => {
      const thousandItems = Array.from({ length: 1000 }, (_, i) => ({
        id: `item_${i}`,
        title: `Title ${i}`,
        score: i % 50, // Scores 0 to 49
      }));

      const start = performance.now();
      const top8 = sampleWheelCandidates(thousandItems, 8);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(top8).toHaveLength(8);
      // All top 8 must have score 49
      for (const item of top8) {
        expect(item.score).toBe(49);
      }
    });

    it("handles candidates with identical, zero, negative, NaN, and undefined scores", () => {
      const strangeItems = [
        { id: "neg_100", score: -100 },
        { id: "zero_1", score: 0 },
        { id: "zero_2", score: 0 },
        { id: "pos_5", score: 5 },
        { id: "nan_score", score: NaN },
        { id: "undef_score", score: undefined },
        { id: "neg_1", score: -1 },
      ];

      const sampled = sampleWheelCandidates(strangeItems, 10);
      expect(sampled.map((s) => s.id)).toEqual([
        "pos_5",
        "zero_1",
        "zero_2",
        "nan_score",
        "undef_score",
        "neg_1",
        "neg_100",
      ]);
    });

    it("handles extreme boundary RNG values (0, 0.99999999, 1.0, and out-of-range RNG)", () => {
      const items = [{ id: "first" }, { id: "middle" }, { id: "last" }];

      // RNG = 0 -> first index
      expect(pickWheelWinner(items, () => 0)?.index).toBe(0);

      // RNG = 0.99999999 -> last index
      expect(pickWheelWinner(items, () => 0.99999999)?.index).toBe(2);

      // Malicious/buggy RNG = 1.0 -> should clamp and NOT exceed items.length - 1
      expect(pickWheelWinner(items, () => 1.0)?.index).toBe(2);

      // Malicious RNG = 5.0 -> should clamp safely
      expect(pickWheelWinner(items, () => 5.0)?.index).toBe(2);

      // Malicious RNG = -1.0 -> should clamp safely to index 0
      expect(pickWheelWinner(items, () => -1.0)?.index).toBe(0);
    });
  });

  describe("Wheel Rotation Physics & NaN/Infinity Prevention", () => {
    it("calculates accurate deceleration rotation degrees across varied slice counts", () => {
      const sliceCounts = [1, 2, 3, 5, 8, 12, 100];

      for (const count of sliceCounts) {
        for (let idx = 0; idx < count; idx++) {
          const rotation = calculateWheelRotation({
            winnerIndex: idx,
            totalSlices: count,
            minSpins: 5,
          });

          expect(Number.isFinite(rotation)).toBe(true);
          expect(rotation).toBeGreaterThanOrEqual(5 * 360);
          expect(rotation).toBeLessThan((5 + 1) * 360 + 360);
        }
      }
    });

    it("prevents NaN and Infinity on corrupt inputs", () => {
      expect(
        calculateWheelRotation({
          winnerIndex: NaN,
          totalSlices: 6,
        }),
      ).toBeGreaterThan(0);

      expect(
        calculateWheelRotation({
          winnerIndex: 0,
          totalSlices: 0,
        }),
      ).toBe(0);

      expect(
        calculateWheelRotation({
          winnerIndex: 0,
          totalSlices: -5,
        }),
      ).toBe(0);

      expect(
        calculateWheelRotation({
          winnerIndex: 0,
          totalSlices: NaN,
        }),
      ).toBe(0);

      expect(
        calculateWheelRotation({
          winnerIndex: 0,
          totalSlices: Infinity,
        }),
      ).toBe(0);
    });

    it("handles boundary and negative minSpins and extra offsets safely", () => {
      // minSpins = 0
      const rotZeroSpins = calculateWheelRotation({
        winnerIndex: 0,
        totalSlices: 4,
        minSpins: 0,
      });
      expect(rotZeroSpins).toBeGreaterThanOrEqual(0);
      expect(rotZeroSpins).toBeLessThan(360);

      // negative minSpins clamped to 0
      const rotNegativeSpins = calculateWheelRotation({
        winnerIndex: 0,
        totalSlices: 4,
        minSpins: -10,
      });
      expect(rotNegativeSpins).toBe(rotZeroSpins);

      // extra offset
      const rotOffset = calculateWheelRotation({
        winnerIndex: 0,
        totalSlices: 4,
        minSpins: 5,
        extraOffset: 45,
      });
      const rotBase = calculateWheelRotation({
        winnerIndex: 0,
        totalSlices: 4,
        minSpins: 5,
        extraOffset: 0,
      });
      expect(rotOffset).toBe(rotBase + 45);
    });
  });

  describe("Adversarial Testing: Proposal Identity Redaction & Anonymity Leaks", () => {
    const mixedBacklog = [
      {
        id: "t_prop_1",
        status: "proposed",
        title: "Dune Messiah",
        addedBy: "user_sneaky_alice",
        expand: {
          addedBy: {
            id: "user_sneaky_alice",
            name: "Alice Confidential",
            email: "alice@secret.org",
          },
        },
      },
      {
        id: "t_prop_2",
        status: "proposed",
        title: "Hyperion",
        addedBy: "user_bob",
        // No expand object present
      },
      {
        id: "t_consumed",
        status: "consumed",
        title: "Foundation",
        addedBy: "user_charlie",
        expand: {
          addedBy: {
            id: "user_charlie",
            name: "Charlie Public",
          },
        },
      },
      {
        id: "t_active",
        status: "active",
        title: "Neuromancer",
        addedBy: "user_david",
        expand: {
          addedBy: {
            id: "user_david",
            name: "David Public",
          },
        },
      },
    ];

    it("strictly determines redaction necessity via shouldRedactProposalIdentity", () => {
      // Blind pick enabled + regular member -> MUST REDACT
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: true,
          isOwnerOrAdmin: false,
        }),
      ).toBe(true);

      // Blind pick enabled + circle owner/admin -> DO NOT REDACT
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: true,
          isOwnerOrAdmin: true,
        }),
      ).toBe(false);

      // Blind pick disabled + regular member -> DO NOT REDACT
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: false,
          isOwnerOrAdmin: false,
        }),
      ).toBe(false);

      // Undefined or empty flags -> DO NOT REDACT
      expect(shouldRedactProposalIdentity({})).toBe(false);
    });

    it("completely wipes addedBy and expand.addedBy for proposed items when blind pick is active", () => {
      const redacted = redactProposedTitles(mixedBacklog, true, false);

      // Item 1: proposed -> redacted
      expect(redacted[0].addedBy).toBe("");
      expect(redacted[0].expand?.addedBy).toBeUndefined();
      expect("addedBy" in (redacted[0].expand || {})).toBe(false);

      // Item 2: proposed without expand -> addedBy wiped safely
      expect(redacted[1].addedBy).toBe("");
      expect(redacted[1].expand).toBeUndefined();

      // Item 3: consumed -> NOT redacted (voting is over)
      expect(redacted[2].addedBy).toBe("user_charlie");
      expect((redacted[2].expand?.addedBy as { name: string })?.name).toBe("Charlie Public");

      // Item 4: active -> NOT redacted
      expect(redacted[3].addedBy).toBe("user_david");

      // Deep string check to guarantee no proposer identity string exists for proposed items
      const jsonStr = JSON.stringify(redacted[0]);
      expect(jsonStr.includes("user_sneaky_alice")).toBe(false);
      expect(jsonStr.includes("Alice Confidential")).toBe(false);
      expect(jsonStr.includes("alice@secret.org")).toBe(false);
    });

    it("preserves identities for circle owners or system admins when blind pick is active", () => {
      const forAdmin = redactProposedTitles(mixedBacklog, true, true);

      expect(forAdmin[0].addedBy).toBe("user_sneaky_alice");
      expect((forAdmin[0].expand?.addedBy as { name: string })?.name).toBe("Alice Confidential");
      expect(forAdmin[1].addedBy).toBe("user_bob");
    });

    it("handles null items, malformed arrays, and missing status properties without crashing", () => {
      const corruptedTitles = [
        null as unknown as (typeof mixedBacklog)[0],
        undefined as unknown as (typeof mixedBacklog)[0],
        { id: "t_no_status", title: "No Status Title" } as unknown as (typeof mixedBacklog)[0],
        {
          id: "t_custom_obj",
          status: "proposed",
          addedBy: "secret_user",
        },
      ];

      const result = redactProposedTitles(corruptedTitles, true, false);
      expect(result).toHaveLength(4);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeUndefined();
      expect(result[2].id).toBe("t_no_status");
      expect(result[3].addedBy).toBe("");
    });

    it("handles empty arrays and nullish array inputs safely", () => {
      expect(redactProposedTitles([], true, false)).toEqual([]);
      expect(redactProposedTitles(null as unknown as [], true, false)).toEqual([]);
      expect(redactProposedTitles(undefined as unknown as [], true, false)).toEqual([]);
    });
  });
});
