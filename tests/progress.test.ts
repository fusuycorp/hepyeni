import { describe, expect, it } from "bun:test";
import type {
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";

// Helper functions testing core progress calculation and invariant rules
function calculateProgressPercentage(
  current?: number,
  total?: number,
  status?: UserMediaProgressStatusOptions,
): number {
  if (status === "completed") return 100;
  if (typeof current !== "number" || typeof total !== "number" || total <= 0) {
    return status === "in_progress" ? 0 : 0;
  }
  const ratio = (current / total) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

function applyQuickStep(
  current: number,
  delta: number,
  total?: number,
): { newCurrent: number; newStatus: UserMediaProgressStatusOptions } {
  const target = Math.max(0, current + delta);
  if (typeof total === "number" && total > 0 && target >= total) {
    return { newCurrent: total, newStatus: "completed" };
  }
  return { newCurrent: target, newStatus: "in_progress" };
}

function filterCircleVisibleProgress(
  items: Array<{ isSharedWithCircles?: boolean; user: string }>,
  viewerUserId: string,
) {
  return items.filter(
    (item) => item.isSharedWithCircles === true || item.user === viewerUserId,
  );
}

describe("User Media Progress & Personal Shelf Logic", () => {
  describe("Progress Percentage Calculations", () => {
    it("returns 100% when status is completed even if counts are not provided", () => {
      expect(calculateProgressPercentage(undefined, undefined, "completed")).toBe(100);
      expect(calculateProgressPercentage(0, 500, "completed")).toBe(100);
    });

    it("calculates exact rounded percentages for active progress", () => {
      expect(calculateProgressPercentage(50, 200, "in_progress")).toBe(25);
      expect(calculateProgressPercentage(1, 3, "in_progress")).toBe(33);
      expect(calculateProgressPercentage(2, 3, "in_progress")).toBe(67);
      expect(calculateProgressPercentage(300, 300, "in_progress")).toBe(100);
    });

    it("clamps percentages between 0 and 100", () => {
      expect(calculateProgressPercentage(-10, 100, "in_progress")).toBe(0);
      expect(calculateProgressPercentage(500, 300, "in_progress")).toBe(100);
    });

    it("handles 0 or invalid total gracefully", () => {
      expect(calculateProgressPercentage(10, 0, "in_progress")).toBe(0);
      expect(calculateProgressPercentage(10, undefined, "in_progress")).toBe(0);
    });
  });

  describe("Quick Step Transitions & Auto-Completion", () => {
    it("increments progress correctly and keeps in_progress status below total", () => {
      const result = applyQuickStep(15, 1, 300);
      expect(result.newCurrent).toBe(16);
      expect(result.newStatus).toBe("in_progress");
    });

    it("decrements progress without dropping below zero", () => {
      const result = applyQuickStep(0, -1, 300);
      expect(result.newCurrent).toBe(0);
      expect(result.newStatus).toBe("in_progress");
    });

    it("auto-completes status when quick-step reaches or exceeds total progress", () => {
      const resultAtTarget = applyQuickStep(299, 1, 300);
      expect(resultAtTarget.newCurrent).toBe(300);
      expect(resultAtTarget.newStatus).toBe("completed");

      const resultExceeding = applyQuickStep(295, 10, 300);
      expect(resultExceeding.newCurrent).toBe(300);
      expect(resultExceeding.newStatus).toBe("completed");
    });
  });

  describe("Privacy & Circle Sharing Filter", () => {
    it("shares public items with any viewer in the circle", () => {
      const list = [
        { isSharedWithCircles: true, user: "user-alice" },
        { isSharedWithCircles: false, user: "user-bob" },
        { isSharedWithCircles: true, user: "user-charlie" },
      ];

      const visibleToStranger = filterCircleVisibleProgress(list, "user-stranger");
      expect(visibleToStranger).toHaveLength(2);
      expect(visibleToStranger.map((i) => i.user)).toEqual(["user-alice", "user-charlie"]);
    });

    it("allows user to always see their own private entries", () => {
      const list = [
        { isSharedWithCircles: true, user: "user-alice" },
        { isSharedWithCircles: false, user: "user-bob" },
      ];

      const visibleToBob = filterCircleVisibleProgress(list, "user-bob");
      expect(visibleToBob).toHaveLength(2);
      expect(visibleToBob.map((i) => i.user)).toContain("user-bob");
    });
  });
});
