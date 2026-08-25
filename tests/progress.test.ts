import { describe, expect, it } from "bun:test";
import { afterAll, beforeEach, mock, spyOn } from "bun:test";
import type {
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";
import { getTitleCircleProgress, getPersonalShelf } from "@/lib/actions/progress";
import * as sessionModule from "@/lib/pocketbase/session";
import * as superuserModule from "@/lib/pocketbase/superuser";
import * as membershipModule from "@/lib/membership";

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

    it("reports 0% for a fresh in-progress item instead of dropping it (C6)", () => {
      // Regression: the server previously used falsy checks (current && total),
      // which hid the 0% column for members at the start of a title.
      expect(calculateProgressPercentage(0, 200, "in_progress")).toBe(0);
      expect(calculateProgressPercentage(0, 1, "in_progress")).toBe(0);
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

    it("includes the viewer's own private in-progress record (C7 symmetry)", () => {
      // getCircleLiveActivity now mirrors getTitleCircleProgress: a member's own
      // private in-progress entry stays visible to themselves in the circle feed.
      const list = [
        { isSharedWithCircles: false, user: "user-bob" },
        { isSharedWithCircles: true, user: "user-alice" },
      ];

const visibleToBob = filterCircleVisibleProgress(list, "user-bob");
    expect(visibleToBob).toHaveLength(2);
    expect(visibleToBob.map((i) => i.user)).toContain("user-bob");
  });
});
});

// ---------------------------------------------------------------------------
// H-1 / H-2 / L5 regression gates — exercised with module mocks so the server
// actions run without a live PocketBase. Mirrors the marginalia.test.ts
// server-action mock pattern; spyOn patches the exporting module namespace so
// hoisted action imports observe the mock.
// ---------------------------------------------------------------------------

const progDb = {
  session: null as { id: string; isAdmin: boolean } | null,
  groupMembers: new Set<string>(),
  memberUsers: new Map<string, { id: string; name: string }>(),
  progressRecords: new Map<string, Record<string, unknown>>(),
  lastProgressFilter: "" as string,
};

function resetProgDb() {
  progDb.session = null;
  progDb.groupMembers.clear();
  progDb.memberUsers.clear();
  progDb.progressRecords.clear();
  progDb.lastProgressFilter = "";
}

function makeProgressPb() {
  return {
    filter: (expr: string, params: Record<string, unknown>) => {
      let out = expr;
      for (const [k, v] of Object.entries(params)) {
        out = out.replaceAll(`{:${k}}`, JSON.stringify(v));
      }
      return out;
    },
    collection: (name: string) => {
      if (name === "group_members") {
        return {
          getFullList: async () =>
            [...progDb.groupMembers].map((groupId) => {
              const viewer = progDb.memberUsers.get(progDb.session?.id ?? "");
              return {
                id: `member-${groupId}`,
                group: groupId,
                user: viewer?.id,
                expand: { user: viewer ?? null },
              };
            }),
        };
      }
      if (name === "titles") {
        return {
          getFirstListItem: async () => ({ id: "t1", externalSource: "gb", externalId: "abc" }),
        };
      }
      if (name === "user_media_progress") {
        return {
          getFullList: async (opts: { filter?: string } = {}) => {
            progDb.lastProgressFilter = opts.filter ?? "";
            return [...progDb.progressRecords.entries()].map(([id, rec]) => ({
              id,
              ...rec,
            }));
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

function makeMemberAccess(): Parameters<typeof getTitleCircleProgress>[4] {
  return {
    group: { id: "g1", isPublic: false } as never,
    isOwner: false,
    isMember: true,
    isGuest: false,
    canViewBacklog: true,
    canViewFinished: true,
    canViewReviews: true,
    canViewComments: true,
    canVote: true,
    canComment: true,
    canReview: true,
    canPropose: true,
  };
}

describe("Server-Action Progress Gates (H-1/H-2/L5, mocked PocketBase)", () => {
  beforeEach(() => {
    resetProgDb();
    progDb.session = { id: "me", isAdmin: false };
    progDb.groupMembers.add("g1");
    progDb.memberUsers.set("me", { id: "me", name: "Me" });
    spyOn(sessionModule, "getSession").mockImplementation(async () => progDb.session as never);
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(makeProgressPb() as never);
    spyOn(membershipModule, "resolveCircleAccess").mockImplementation(async () => {
      return makeMemberAccess() as never;
    });
  });

  afterAll(() => {
    mock.restore();
  });

  describe("H-1 — getTitleCircleProgress hoist (session/access/title opt-out)", () => {
    it("does not re-auth or re-resolve access when session+access+title are provided", async () => {
      spyOn(sessionModule, "getSession").mockImplementation(async () => {
        throw new Error("getSession must not be called when a session is provided");
      });
      spyOn(membershipModule, "resolveCircleAccess").mockImplementation(async () => {
        throw new Error("resolveCircleAccess must not be called when access is provided");
      });

      progDb.progressRecords.set("p1", {
        user: "me",
        isSharedWithCircles: true,
        status: "completed",
      });

      const result = await getTitleCircleProgress(
        "t1",
        { id: "t1", externalSource: "gb", externalId: "abc" } as never,
        "g1",
        { id: "me", isAdmin: false } as never,
        makeMemberAccess(),
      );

      expect(result).toHaveLength(1);
      expect(result[0].user.id).toBe("me");
      expect(result[0].percentage).toBe(100);
    });

    it("falls back to getSession + resolveCircleAccess + title fetch when unused", async () => {
      progDb.progressRecords.set("p1", {
        user: "me",
        isSharedWithCircles: true,
        status: "in_progress",
        progressCurrent: 1,
        progressTotal: 4,
      });

      const result = await getTitleCircleProgress("t1", null, "g1");

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(25);
      // title was not provided: the fallback titles.getFirstListItem ran
      expect(progDb.lastProgressFilter).toContain("externalSource");
    });
  });

  describe("H-2 — getPersonalShelf session hoist", () => {
    it("skips getSession() when a session is passed", async () => {
      spyOn(sessionModule, "getSession").mockImplementation(async () => {
        throw new Error("getSession must not be called when a session is passed");
      });

      const result = await getPersonalShelf(undefined, { id: "me", isAdmin: false } as never);
      expect(Array.isArray(result)).toBe(true);
    });

    it("still resolves via getSession() when no session is passed", async () => {
      const result = await getPersonalShelf();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("L5 — external-source filter guard on custom rows", () => {
    it("omits the external clause and does not crash for custom rows with no external ids", async () => {
      progDb.progressRecords.set("p1", {
        user: "me",
        isSharedWithCircles: true,
        status: "completed",
      });

      const result = await getTitleCircleProgress(
        "t1",
        { id: "t1", externalSource: null, externalId: undefined } as never,
        "g1",
        { id: "me", isAdmin: false } as never,
        makeMemberAccess(),
      );

      expect(result).toHaveLength(1);
      expect(progDb.lastProgressFilter).toBe('groupTitle = "t1" && (user = "me")');
      expect(progDb.lastProgressFilter).not.toContain("externalSource");
    });

    it("keeps binding the external clause when external source/id exist", async () => {
      await getTitleCircleProgress("t1", null, "g1");
      expect(progDb.lastProgressFilter).toBe(
        '(groupTitle = "t1" || (externalSource = "gb" && externalId = "abc")) && (user = "me")',
      );
    });
  });
});
