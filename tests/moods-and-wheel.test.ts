import { describe, expect, it } from "bun:test";
import {
  MOODS,
  PACES,
  isMood,
  isPace,
  normalizeMoods,
  normalizePace,
  filterTitlesByMood,
  shouldRedactProposalIdentity,
  redactProposedTitles,
  sampleWheelCandidates,
  pickWheelWinner,
  calculateWheelRotation,
  type MoodType,
  type PaceType,
} from "@/lib/moods";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Phase 4: Mood & Pace Taxonomy + Blind Pick Wheel", () => {
  describe("Mood & Pace Taxonomy Definitions", () => {
    it("contains all 9 required moods in the taxonomy", () => {
      const expectedMoods: MoodType[] = [
        "cozy",
        "dark",
        "melancholic",
        "mind_bending",
        "uplifting",
        "nostalgic",
        "whimsical",
        "tense",
        "philosophical",
      ];
      expect(MOODS).toEqual(expectedMoods as unknown as typeof MOODS);
      expect(MOODS.length).toBe(9);
    });

    it("contains all 3 required pacing options in the taxonomy", () => {
      const expectedPaces: PaceType[] = ["slow_burn", "gentle", "fast_paced"];
      expect(PACES).toEqual(expectedPaces as unknown as typeof PACES);
      expect(PACES.length).toBe(3);
    });

    it("correctly validates moods with isMood type guard", () => {
      expect(isMood("cozy")).toBe(true);
      expect(isMood("dark")).toBe(true);
      expect(isMood("mind_bending")).toBe(true);
      expect(isMood("philosophical")).toBe(true);
      expect(isMood("random_invalid_mood")).toBe(false);
      expect(isMood(null)).toBe(false);
      expect(isMood(undefined)).toBe(false);
      expect(isMood(123)).toBe(false);
      expect(isMood({})).toBe(false);
    });

    it("correctly validates paces with isPace type guard", () => {
      expect(isPace("slow_burn")).toBe(true);
      expect(isPace("gentle")).toBe(true);
      expect(isPace("fast_paced")).toBe(true);
      expect(isPace("medium")).toBe(false);
      expect(isPace(null)).toBe(false);
      expect(isPace(undefined)).toBe(false);
    });
  });

  describe("Multi-Select Mood Normalization & Pacing", () => {
    it("normalizes array of moods by removing duplicates and invalid values", () => {
      const raw = ["cozy", "dark", "cozy", "invalid", "uplifting", null, 42];
      const normalized = normalizeMoods(raw);
      expect(normalized).toEqual(["cozy", "dark", "uplifting"]);
    });

    it("handles null, undefined, strings, and non-array inputs safely", () => {
      expect(normalizeMoods(null)).toEqual([]);
      expect(normalizeMoods(undefined)).toEqual([]);
      expect(normalizeMoods("cozy")).toEqual(["cozy"]);
      expect(normalizeMoods("invalid")).toEqual([]);
      expect(normalizeMoods({})).toEqual([]);
    });

    it("normalizes pace strings safely", () => {
      expect(normalizePace("slow_burn")).toBe("slow_burn");
      expect(normalizePace("gentle")).toBe("gentle");
      expect(normalizePace("fast_paced")).toBe("fast_paced");
      expect(normalizePace("invalid")).toBeUndefined();
      expect(normalizePace(null)).toBeUndefined();
      expect(normalizePace(undefined)).toBeUndefined();
    });
  });

  describe("Backlog & Shelf Mood Filtering", () => {
    const mockItems = [
      {
        id: "1",
        title: "Dune",
        moods: ["mind_bending" as MoodType, "philosophical" as MoodType],
      },
      {
        id: "2",
        title: "A Man Called Ove",
        moods: ["cozy" as MoodType, "uplifting" as MoodType],
      },
      {
        id: "3",
        title: "No Country for Old Men",
        metadata: { moods: ["dark", "tense"] },
      },
      {
        id: "4",
        title: "The Hobbit",
        moods: ["nostalgic" as MoodType, "cozy" as MoodType, "whimsical" as MoodType],
      },
      {
        id: "5",
        title: "Generic Untitled",
      },
    ];

    it("returns all items when filter is 'all', empty, null, or undefined", () => {
      expect(filterTitlesByMood(mockItems, "all")).toHaveLength(5);
      expect(filterTitlesByMood(mockItems, "")).toHaveLength(5);
      expect(filterTitlesByMood(mockItems, undefined)).toHaveLength(5);
      expect(filterTitlesByMood(mockItems, null)).toHaveLength(5);
    });

    it("filters items correctly by specific mood from direct moods field or metadata", () => {
      const cozyItems = filterTitlesByMood(mockItems, "cozy");
      expect(cozyItems.map((i) => i.id)).toEqual(["2", "4"]);

      const darkItems = filterTitlesByMood(mockItems, "dark");
      expect(darkItems.map((i) => i.id)).toEqual(["3"]);

      const mindBending = filterTitlesByMood(mockItems, "mind_bending");
      expect(mindBending.map((i) => i.id)).toEqual(["1"]);

      const melancholic = filterTitlesByMood(mockItems, "melancholic");
      expect(melancholic).toHaveLength(0);
    });
  });

  describe("Blind Proposal Identity Redaction", () => {
    it("identifies when proposal identities should be redacted", () => {
      // Blind pick disabled -> never redact
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: false,
          isOwnerOrAdmin: false,
        }),
      ).toBe(false);

      // Blind pick enabled and regular member -> REDACT
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: true,
          isOwnerOrAdmin: false,
        }),
      ).toBe(true);

      // Blind pick enabled but user is circle owner or admin -> DO NOT REDACT
      expect(
        shouldRedactProposalIdentity({
          isBlindPickEnabled: true,
          isOwnerOrAdmin: true,
        }),
      ).toBe(false);
    });

    it("redacts addedBy from proposed titles when blind pick is active for non-owner/admin", () => {
      const titles = [
        {
          id: "t1",
          status: "proposed",
          title: "Secret Book",
          addedBy: "user_123",
          expand: { addedBy: { id: "user_123", name: "Alice" } },
        },
        {
          id: "t2",
          status: "consumed",
          title: "Finished Movie",
          addedBy: "user_456",
          expand: { addedBy: { id: "user_456", name: "Bob" } },
        },
      ];

      const redacted = redactProposedTitles(titles, true, false);

      // Proposed title should be redacted
      expect(redacted[0].addedBy).toBe("");
      expect(redacted[0].expand?.addedBy).toBeUndefined();
      expect(redacted[0].title).toBe("Secret Book");

      // Consumed title should NOT be redacted (voting is finished)
      expect(redacted[1].addedBy).toBe("user_456");
      expect(redacted[1].expand?.addedBy?.name).toBe("Bob");
    });

    it("leaves titles unchanged if user is owner/admin or blind pick is disabled", () => {
      const titles = [
        {
          id: "t1",
          status: "proposed",
          title: "Secret Book",
          addedBy: "user_123",
          expand: { addedBy: { id: "user_123", name: "Alice" } },
        },
      ];

      const unchangedForOwner = redactProposedTitles(titles, true, true);
      expect(unchangedForOwner[0].addedBy).toBe("user_123");
      expect(unchangedForOwner[0].expand?.addedBy?.name).toBe("Alice");

      const unchangedDisabled = redactProposedTitles(titles, false, false);
      expect(unchangedDisabled[0].addedBy).toBe("user_123");
      expect(unchangedDisabled[0].expand?.addedBy?.name).toBe("Alice");
    });
  });

  describe("Decision Wheel Item Sampling & Fair Randomizer", () => {
    const mockBacklog = [
      { id: "1", title: "Item 1", score: 10 },
      { id: "2", title: "Item 2", score: 8 },
      { id: "3", title: "Item 3", score: 5 },
      { id: "4", title: "Item 4", score: 3 },
      { id: "5", title: "Item 5", score: 2 },
      { id: "6", title: "Item 6", score: 1 },
      { id: "7", title: "Item 7", score: 0 },
      { id: "8", title: "Item 8", score: -1 },
      { id: "9", title: "Item 9", score: -2 },
      { id: "10", title: "Item 10", score: -5 },
    ];

    it("samples top-voted backlog candidates capped by maxCandidates (default 8)", () => {
      const candidates = sampleWheelCandidates(mockBacklog, 8);
      expect(candidates).toHaveLength(8);
      expect(candidates[0].id).toBe("1");
      expect(candidates[7].id).toBe("8");
    });

    it("handles empty or small backlog safely", () => {
      expect(sampleWheelCandidates([], 8)).toEqual([]);
      const small = [{ id: "1", title: "Solo", score: 1 }];
      expect(sampleWheelCandidates(small, 8)).toHaveLength(1);
    });

    it("picks winner deterministically with a given RNG", () => {
      const candidates = sampleWheelCandidates(mockBacklog, 4); // Items 1, 2, 3, 4

      // rng returning 0 -> index 0 (Item 1)
      const win0 = pickWheelWinner(candidates, () => 0);
      expect(win0?.winner.id).toBe("1");
      expect(win0?.index).toBe(0);

      // rng returning 0.25 -> index 1 (Item 2)
      const win1 = pickWheelWinner(candidates, () => 0.25);
      expect(win1?.winner.id).toBe("2");
      expect(win1?.index).toBe(1);

      // rng returning 0.75 -> index 3 (Item 4)
      const win3 = pickWheelWinner(candidates, () => 0.75);
      expect(win3?.winner.id).toBe("4");
      expect(win3?.index).toBe(3);

      // rng returning 0.9999 -> index 3 (Item 4)
      const winLast = pickWheelWinner(candidates, () => 0.9999);
      expect(winLast?.winner.id).toBe("4");
      expect(winLast?.index).toBe(3);

      // Empty list returns null
      expect(pickWheelWinner([], () => 0.5)).toBeNull();
    });

    it("demonstrates fair uniform distribution across multiple iterations", () => {
      const candidates = sampleWheelCandidates(mockBacklog, 4);
      const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const res = pickWheelWinner(candidates, Math.random);
        if (res) {
          counts[res.index]++;
        }
      }

      // Each slice should get roughly 25% (2500), allow +/- 10% tolerance (1500 to 3500)
      for (let i = 0; i < 4; i++) {
        expect(counts[i]).toBeGreaterThan(2000);
        expect(counts[i]).toBeLessThan(3000);
      }
    });

    it("calculates accurate wheel rotation angles with multi-spin deceleration", () => {
      const totalSlices = 6;
      // For slice 0, target angle points slice 0 to the top pointer
      const rotSlice0 = calculateWheelRotation({
        winnerIndex: 0,
        totalSlices,
        minSpins: 5,
      });
      expect(rotSlice0).toBeGreaterThanOrEqual(360 * 5);

      // Different winner index gives different rotation
      const rotSlice3 = calculateWheelRotation({
        winnerIndex: 3,
        totalSlices,
        minSpins: 5,
      });
      expect(rotSlice3).not.toBe(rotSlice0);
    });

    it("handles zero backlog candidate edge cases gracefully without division-by-zero crashes", () => {
      expect(sampleWheelCandidates([])).toEqual([]);
      expect(pickWheelWinner([])).toBeNull();
      expect(calculateWheelRotation({ winnerIndex: 0, totalSlices: 0 })).toBe(0);
    });
  });

  describe("i18n Translation Key Parity for Moods, Wheel, and Blind Pick", () => {
    it("ensures mood taxonomy keys exist in both English and Turkish", () => {
      for (const mood of MOODS) {
        expect(en.moods[mood]).toBeDefined();
        expect(typeof en.moods[mood]).toBe("string");
        expect(en.moods[mood].length).toBeGreaterThan(0);

        expect(tr.moods[mood]).toBeDefined();
        expect(typeof tr.moods[mood]).toBe("string");
        expect(tr.moods[mood].length).toBeGreaterThan(0);
      }
    });

    it("ensures pacing taxonomy keys exist in both English and Turkish", () => {
      for (const pace of PACES) {
        expect(en.moods[pace]).toBeDefined();
        expect(typeof en.moods[pace]).toBe("string");
        expect(en.moods[pace].length).toBeGreaterThan(0);

        expect(tr.moods[pace]).toBeDefined();
        expect(typeof tr.moods[pace]).toBe("string");
        expect(tr.moods[pace].length).toBeGreaterThan(0);
      }
    });

    it("ensures wheel and blindPick domain keys are complete and non-empty in both EN and TR", () => {
      const requiredWheelKeys = [
        "spinWheel",
        "spinning",
        "spinToDecide",
        "winnerTitle",
        "winnerAnnounce",
        "respin",
        "viewWinner",
        "needBacklogItems",
        "candidatesCount",
      ];

      for (const key of requiredWheelKeys) {
        expect(en.wheel[key as keyof typeof en.wheel]).toBeDefined();
        expect(en.wheel[key as keyof typeof en.wheel].length).toBeGreaterThan(0);

        expect(tr.wheel[key as keyof typeof tr.wheel]).toBeDefined();
        expect(tr.wheel[key as keyof typeof tr.wheel].length).toBeGreaterThan(0);
      }

      const requiredBlindPickKeys = [
        "title",
        "description",
        "toggleLabel",
        "enabledStatus",
        "disabledStatus",
        "anonymousRecommender",
        "modeNotice",
        "updatedSuccess",
        "updatedFailed",
      ];

      for (const key of requiredBlindPickKeys) {
        expect(en.blindPick[key as keyof typeof en.blindPick]).toBeDefined();
        expect(en.blindPick[key as keyof typeof en.blindPick].length).toBeGreaterThan(0);

        expect(tr.blindPick[key as keyof typeof tr.blindPick]).toBeDefined();
        expect(tr.blindPick[key as keyof typeof tr.blindPick].length).toBeGreaterThan(0);
      }
    });
  });
});
