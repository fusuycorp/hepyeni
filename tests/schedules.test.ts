import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

function calculateMilestoneCompletionRate(
  checkinCount: number,
  memberCount: number,
): number {
  if (memberCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((checkinCount / memberCount) * 100)));
}

function orderMilestones<T extends { orderIndex?: number; targetDate?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (typeof a.orderIndex === "number" && typeof b.orderIndex === "number") {
      return a.orderIndex - b.orderIndex;
    }
    if (a.targetDate && b.targetDate) {
      return a.targetDate.localeCompare(b.targetDate);
    }
    return 0;
  });
}

describe("Group Schedules & Milestone Pacing Logic", () => {
  describe("Milestone Completion Rate", () => {
    it("calculates accurate percentage of members who checked in", () => {
      expect(calculateMilestoneCompletionRate(0, 5)).toBe(0);
      expect(calculateMilestoneCompletionRate(1, 4)).toBe(25);
      expect(calculateMilestoneCompletionRate(2, 3)).toBe(67);
      expect(calculateMilestoneCompletionRate(5, 5)).toBe(100);
    });

    it("handles 0 members safely without division by zero", () => {
      expect(calculateMilestoneCompletionRate(2, 0)).toBe(0);
    });

    it("clamps checkins to max 100% even if extra checkins exist", () => {
      expect(calculateMilestoneCompletionRate(10, 5)).toBe(100);
    });
  });

  describe("Milestone Sequence Ordering", () => {
    it("sorts milestones stably by orderIndex", () => {
      const unordered = [
        { id: "m3", orderIndex: 2, title: "Chapters 11-15" },
        { id: "m1", orderIndex: 0, title: "Chapters 1-5" },
        { id: "m2", orderIndex: 1, title: "Chapters 6-10" },
      ];

      const sorted = orderMilestones(unordered);
      expect(sorted.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    });

    it("falls back to targetDate sorting when orderIndex is absent", () => {
      const dates = [
        { id: "d3", targetDate: "2026-10-15", title: "Finale" },
        { id: "d1", targetDate: "2026-09-01", title: "Kickoff" },
        { id: "d2", targetDate: "2026-09-15", title: "Midpoint" },
      ];

      const sorted = orderMilestones(dates);
      expect(sorted.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
    });
  });

  describe("i18n Translation Completeness for Shelf and Schedules", () => {
    it("has all required shelf keys in both EN and TR", () => {
      const requiredShelfKeys = [
        "pageTitle",
        "pageSubtitle",
        "addToShelf",
        "editProgress",
        "saveProgress",
        "progressSaved",
        "statusInProgress",
        "statusCompleted",
        "statusPlanToConsume",
        "currentProgress",
        "totalProgress",
        "currentUnit",
        "pages",
        "chapters",
        "episodes",
        "minutes",
        "percent",
        "shareWithCircles",
        "shareWithCirclesDesc",
        "circleProgressTitle",
      ];

      for (const key of requiredShelfKeys) {
        expect(key in en.shelf).toBe(true);
        expect(key in tr.shelf).toBe(true);
        expect((en.shelf as Record<string, string>)[key].length).toBeGreaterThan(0);
        expect((tr.shelf as Record<string, string>)[key].length).toBeGreaterThan(0);
      }
    });

    it("has all required schedules keys in both EN and TR", () => {
      const requiredScheduleKeys = [
        "schedulesTitle",
        "schedulesSubtitle",
        "createSchedule",
        "createScheduleTitle",
        "scheduleName",
        "scheduleDesc",
        "linkedTitle",
        "startDate",
        "targetDate",
        "addMilestone",
        "milestonesHeading",
        "checkIn",
        "checkedIn",
        "membersCompleted",
      ];

      for (const key of requiredScheduleKeys) {
        expect(key in en.schedules).toBe(true);
        expect(key in tr.schedules).toBe(true);
        expect((en.schedules as Record<string, string>)[key].length).toBeGreaterThan(0);
        expect((tr.schedules as Record<string, string>)[key].length).toBeGreaterThan(0);
      }
    });
  });
});
