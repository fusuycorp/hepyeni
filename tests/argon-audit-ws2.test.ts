import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { groupTitleQuery } from "@/lib/group-titles";
import { redactProposedTitles } from "@/lib/moods";
import { parseTags } from "@/lib/marginalia";
import * as sessionModule from "@/lib/pocketbase/session";
import * as superuserModule from "@/lib/pocketbase/superuser";
import * as membershipModule from "@/lib/membership";
import * as flagsServerModule from "@/lib/flags/server";
import * as nextCacheModule from "next/cache";
import * as progressQueryModule from "@/lib/queries/progress";
import {
  getTitleCircleProgress as getTitleCircleProgressAction,
  saveMediaProgress,
  updateProgressQuickStep,
} from "@/lib/actions/progress";
import {
  getPersonalShelf,
  getTitleCircleProgress as getTitleCircleProgressQuery,
} from "@/lib/queries/progress";
import { getGroupSchedules } from "@/lib/queries/schedules";
import {
  createGroupSchedule,
  getMilestoneComments,
} from "@/lib/actions/schedules";
import { fetchCircleTitleDetail } from "@/lib/queries/circle-feed";
import {
  addTitle,
  markConsumed,
  unmarkConsumed,
} from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { toggleShareQuoteWithCircle } from "@/lib/actions/marginalia";
import { ClientResponseError } from "pocketbase";

describe("Workstream 2 — Argon Audit Remediations", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("P0-2: Progress & Schedule Seams", () => {
    it("ignores client-supplied title in getTitleCircleProgress server action", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        email: "u1@example.com",
        name: "User 1",
        isAdmin: false,
      } as never);

      let passedTitle: unknown = "UNSET";
      spyOn(progressQueryModule, "getTitleCircleProgress").mockImplementation(
        async (_titleId, title) => {
          passedTitle = title;
          return [];
        },
      );

      await getTitleCircleProgressAction(
        "t1",
        {
          id: "t1",
          group: "g1",
          externalSource: "forged_source",
          externalId: "forged_id",
        } as never,
        "g1",
      );

      expect(passedTitle).toBeNull();
    });

    it("re-fetches title from PocketBase in getTitleCircleProgress query if title id or group mismatches", async () => {
      let titleFetchedFromPb = false;
      const pbMock = {
        filter: (expr: string, params: Record<string, unknown>) => {
          let out = expr;
          for (const [k, v] of Object.entries(params)) {
            out = out.replaceAll(`{:${k}}`, JSON.stringify(v));
          }
          return out;
        },
        collection: (name: string) => {
          if (name === "titles") {
            return {
              getFirstListItem: async () => {
                titleFetchedFromPb = true;
                return {
                  id: "t1",
                  group: "g1",
                  externalSource: "real_src",
                  externalId: "real_ext",
                };
              },
            };
          }
          if (name === "group_members") {
            return {
              getFullList: async () => [],
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      };

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
        pbMock as never,
      );

      await getTitleCircleProgressQuery(
        "t1",
        { id: "t1", group: "wrong_group", externalSource: "fake", externalId: "fake" } as never,
        "g1",
        { id: "u1", isAdmin: false } as never,
        {
          group: { id: "g1", isPublic: true },
          isMember: true,
        } as never,
      );

      expect(titleFetchedFromPb).toBe(true);
    });

    it("does not re-invoke getSession() when null guest session is explicitly passed", async () => {
      const getSessionSpy = spyOn(sessionModule, "getSession").mockImplementation(
        async () => {
          throw new Error("getSession() should not be called when session is null");
        },
      );
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        group: { id: "g1", isPublic: false },
        isMember: false,
      } as never);

      const shelf = await getPersonalShelf(undefined, null);
      expect(shelf).toEqual([]);

      const progress = await getTitleCircleProgressQuery("t1", null, "g1", null);
      expect(progress).toEqual([]);

      const schedules = await getGroupSchedules("g1", null);
      expect(schedules).toEqual([]);

      expect(getSessionSpy).not.toHaveBeenCalled();
    });

    it("redacts foreign groupTitle IDs on progress records matched via externalSource/externalId", async () => {
      const pbMock = {
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "group_members") {
            return {
              getFullList: async () => [
                {
                  id: "gm1",
                  group: "g1",
                  user: "u1",
                  expand: { user: { id: "u1", name: "Alice" } },
                },
              ],
            };
          }
          if (name === "user_media_progress") {
            return {
              getFullList: async () => [
                {
                  id: "p1",
                  user: "u1",
                  groupTitle: "foreign_title_999",
                  status: "in_progress",
                  progressCurrent: 50,
                  progressTotal: 100,
                  isSharedWithCircles: true,
                },
              ],
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      };

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
        pbMock as never,
      );

      const items = await getTitleCircleProgressQuery(
        "t1",
        { id: "t1", group: "g1", externalSource: "tmdb", externalId: "123" } as never,
        "g1",
        { id: "u1", isAdmin: false } as never,
        { group: { id: "g1", isPublic: true }, isMember: true } as never,
      );

      expect(items).toHaveLength(1);
      expect(items[0].progress.groupTitle).toBe("");
    });
  });

  describe("P1-3, P1-4, P1-5, P2-1, P2-2: Circle Feed, Blind Pick & Schedules", () => {
    it("P1-4: includes consumedAt in groupTitleQuery fields", () => {
      const query = groupTitleQuery(true);
      expect(query.fields.split(",")).toContain("consumedAt");
    });

    it("P2-1: redactProposedTitles preserves currentUserId's own review while stripping others", () => {
      const titles = [
        {
          id: "t1",
          status: "proposed",
          addedBy: "u1",
          expand: {
            addedBy: { id: "u1", name: "Alice" },
            votes_via_title: [{ id: "v1", user: "u1", value: "up" }],
            reviews_via_title: [
              { id: "r1", user: "u1", rating: 5, reviewText: "Alice review" },
              { id: "r2", user: "u2", rating: 4, reviewText: "Bob own review" },
            ],
          },
        },
      ];

      // Without currentUserId: strips all reviews_via_title
      const redactedAll = redactProposedTitles(titles, true, false);
      expect(redactedAll[0].addedBy).toBe("");
      expect(redactedAll[0].expand?.addedBy).toBeUndefined();
      expect(redactedAll[0].expand?.reviews_via_title).toBeUndefined();

      // With currentUserId = "u2": preserves only u2's review
      const redactedWithViewer = redactProposedTitles(titles, true, false, "u2");
      expect(redactedWithViewer[0].addedBy).toBe("");
      expect(redactedWithViewer[0].expand?.addedBy).toBeUndefined();
      expect(redactedWithViewer[0].expand?.reviews_via_title).toEqual([
        { id: "r2", user: "u2", rating: 4, reviewText: "Bob own review" },
      ]);
    });

    it("P1-3: getGroupSchedules redacts proposed titleRecord.addedBy when blind pick is enabled", async () => {
      const pbMock = {
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "group_schedules") {
            return {
              getFullList: async () => [
                {
                  id: "s1",
                  group: "g1",
                  name: "Week 1",
                  expand: {
                    title: {
                      id: "t1",
                      status: "proposed",
                      addedBy: "secret_proposer",
                      expand: {
                        addedBy: { id: "secret_proposer", name: "Secret" },
                      },
                    },
                    createdBy: {
                      id: "u1",
                      name: "Owner",
                      email: "owner@secret.com",
                    },
                  },
                },
              ],
            };
          }
          if (name === "schedule_milestones") {
            return { getFullList: async () => [] };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      };

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
        pbMock as never,
      );

      const schedules = await getGroupSchedules(
        "g1",
        { id: "u2", isAdmin: false } as never,
        {
          group: { id: "g1", isPublic: true, isBlindPickEnabled: true },
          isMember: true,
          isOwner: false,
        } as never,
      );

      expect(schedules).toHaveLength(1);
      expect(schedules[0].titleRecord?.addedBy).toBe("");
      expect(
        (schedules[0].titleRecord?.expand as Record<string, unknown> | undefined)
          ?.addedBy,
      ).toBeUndefined();
    });

    it("P1-5: fetchCircleTitleDetail enforces guest canViewBacklog and canViewFinished gates", async () => {
      spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
        id: "t1",
        group: "g1",
        status: "proposed",
      } as never);
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        group: { id: "g1", isPublic: true },
        isMember: false,
        isOwner: false,
        canViewBacklog: false,
        canViewFinished: true,
        canViewReviews: false,
        canViewComments: false,
      } as never);

      await expect(
        fetchCircleTitleDetail("g1", "t1", null),
      ).rejects.toThrow("ACCESS_DENIED");
    });

    it("P2-2: fetchCircleTitleDetail computes score from leanVoteRows when !canViewReviews and strips addedBy email", async () => {
      spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
        id: "t1",
        group: "g1",
        status: "proposed",
      } as never);
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        group: { id: "g1", isPublic: true, isBlindPickEnabled: false },
        isMember: false,
        isOwner: false,
        canViewBacklog: true,
        canViewFinished: true,
        canViewReviews: false,
        canViewComments: false,
      } as never);
      spyOn(progressQueryModule, "getTitleCircleProgress").mockResolvedValue([]);

      const pbMock = {
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "titles") {
            return {
              getOne: async () => ({
                id: "t1",
                group: "g1",
                title: "Dune",
                status: "proposed",
                expand: {
                  addedBy: {
                    id: "u1",
                    name: "Alice",
                    email: "alice@private.com",
                  },
                },
              }),
            };
          }
          if (name === "votes") {
            return {
              getFullList: async () => [
                { id: "v1", title: "t1", user: "u1", value: "up" },
                { id: "v2", title: "t1", user: "u2", value: "up" },
              ],
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      };

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
        pbMock as never,
      );

      const detail = await fetchCircleTitleDetail("g1", "t1", null);
      expect(detail.title.score).toBe(2);
      expect((detail.title.expand?.addedBy as Record<string, unknown>)?.email).toBeUndefined();
      expect(detail.title.expand?.addedBy?.name).toBe("Alice");
    });
  });

  describe("P1-6 & P2-10: Schedule Actions", () => {
    it("getMilestoneComments locks comments when !access.canViewComments or when non-member has stale checkin", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "kicked_user",
        isAdmin: false,
      } as never);
      spyOn(membershipModule, "requireMilestoneInGroup").mockResolvedValue(
        {} as never,
      );

      // Case 1: !canViewComments returns empty locked result immediately
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValueOnce({
        group: { id: "g1", isPublic: true },
        isMember: false,
        canViewComments: false,
      } as never);

      const lockedRes = await getMilestoneComments("m1", "g1");
      expect(lockedRes.success).toBe(true);
      if (lockedRes.success) {
        expect(lockedRes.data).toEqual({
          comments: [],
          hasCheckedIn: false,
          isLocked: true,
          lockedCount: 0,
        });
      }

      // Case 2: canViewComments is true for guest on public group, but kicked_user is not a member
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValueOnce({
        group: { id: "g1", isPublic: true },
        isMember: false,
        canViewComments: true,
      } as never);

      let checkinQueried = false;
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "milestone_checkins") {
            return {
              getFirstListItem: async () => {
                checkinQueried = true;
                return { id: "chk1", milestone: "m1", user: "kicked_user" };
              },
            };
          }
          if (name === "milestone_comments") {
            return {
              getFullList: async () => [
                {
                  id: "c1",
                  milestone: "m1",
                  user: "u1",
                  group: "g1",
                  content: "Secret spoiler",
                  isSpoiler: true,
                  createdAt: "2026-08-01T00:00:00Z",
                },
              ],
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const staleRes = await getMilestoneComments("m1", "g1");
      expect(checkinQueried).toBe(false);
      expect(staleRes.success).toBe(true);
      if (staleRes.success) {
        expect(staleRes.data.hasCheckedIn).toBe(false);
        expect(staleRes.data.comments[0].content).toBeUndefined();
        expect(staleRes.data.comments[0].isLocked).toBe(true);
      }
    });

    it("createGroupSchedule rejects > 50 milestones", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        group: { id: "g1" },
        isMember: true,
      } as never);

      const milestones = Array.from({ length: 51 }, (_, i) => ({
        title: `Milestone ${i + 1}`,
      }));

      const res = await createGroupSchedule("g1", {
        name: "Big Schedule",
        milestones,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("50");
      }
    });
  });

  describe("P1-7 & P2-10: Progress Actions", () => {
    it("saveMediaProgress preserves existing isSharedWithCircles=false and startedAt, and strips unsafe coverUrl", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});

      const updatedData: Record<string, unknown> = {};
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "user_media_progress") {
            return {
              getOne: async () => ({
                id: "p1",
                user: "u1",
                isSharedWithCircles: false,
                startedAt: "2026-01-01T00:00:00.000Z",
              }),
              update: async (_id: string, data: Record<string, unknown>) => {
                Object.assign(updatedData, data);
                return { id: "p1", ...data };
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const res = await saveMediaProgress({
        id: "p1",
        mediaType: "book",
        title: "Dune",
        coverUrl: "javascript:alert(1)",
        status: "in_progress",
      });

      expect(res.success).toBe(true);
      expect(updatedData.isSharedWithCircles).toBe(false);
      expect(updatedData.startedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(updatedData.coverUrl).toBeNull();
    });

    it("updateProgressQuickStep rejects non-finite delta and clamps to progressTotal", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});

      const nanRes = await updateProgressQuickStep("p1", Number.NaN);
      expect(nanRes.success).toBe(false);

      const updatedPayload: Record<string, unknown> = {};
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        collection: () => ({
          getOne: async () => ({
            id: "p1",
            user: "u1",
            status: "in_progress",
            progressCurrent: 95,
            progressTotal: 100,
          }),
          update: async (_id: string, data: Record<string, unknown>) => {
            Object.assign(updatedPayload, data);
            return { id: "p1", ...data };
          },
        }),
      } as never);

      const clampRes = await updateProgressQuickStep("p1", 20);
      expect(clampRes.success).toBe(true);
      expect(updatedPayload.progressCurrent).toBe(100);
    });
  });

  describe("P1-8 & P2-10: Titles & Reviews Actions", () => {
    it("markConsumed ignores private completions (isSharedWithCircles = false) when checking circle completion", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});
      spyOn(membershipModule, "requireMembership").mockResolvedValue({
        id: "gm1",
        role: "member",
      } as never);
      spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
        id: "t1",
        group: "g1",
        mediaType: "book",
        title: "Dune",
      } as never);

      let progressFilterUsed = "";
      let titleUpdated = false;
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "user_media_progress") {
            return {
              getFirstListItem: async () => ({ id: "p1", user: "u1" }),
              update: async () => ({}),
              getFullList: async (opts: { filter?: string }) => {
                progressFilterUsed = opts.filter ?? "";
                return [{ id: "p1", user: "u1", isSharedWithCircles: true }];
              },
            };
          }
          if (name === "group_members") {
            return {
              getFullList: async () => [
                { id: "gm1", user: "u1" },
                { id: "gm2", user: "u2" },
              ],
            };
          }
          if (name === "titles") {
            return {
              update: async () => {
                titleUpdated = true;
                return {};
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const res = await markConsumed("t1", "g1");
      expect(res.success).toBe(true);
      expect(progressFilterUsed).toContain("isSharedWithCircles != false");
      expect(titleUpdated).toBe(false);
    });

    it("unmarkConsumed does not demote circle title if non-owner member had no progress record", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u2",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});
      spyOn(membershipModule, "requireMembership").mockResolvedValue({
        id: "gm2",
        role: "member",
      } as never);
      spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
        id: "t1",
        group: "g1",
      } as never);

      let titleDemoted = false;
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "user_media_progress") {
            return {
              getFirstListItem: async () => {
                throw new Error("not found");
              },
            };
          }
          if (name === "titles") {
            return {
              update: async () => {
                titleDemoted = true;
                return {};
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const res = await unmarkConsumed("t1", "g1");
      expect(res.success).toBe(true);
      expect(titleDemoted).toBe(false);
    });

    it("addTitle rejects missing externalSource or externalId", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        canPropose: true,
      } as never);
      const pbSpy = spyOn(superuserModule, "getSuperuserClient");

      const res = await addTitle("g1", "book", {
        title: "Valid Title",
        externalSource: "   ",
        externalId: "",
      } as never);

      expect(res.success).toBe(false);
      expect(pbSpy).not.toHaveBeenCalled();
    });

    it("submitReview clears reviewText when clearReviewText flag is explicitly set", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});
      spyOn(membershipModule, "resolveCircleAccess").mockResolvedValue({
        canReview: true,
      } as never);
      spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
        id: "t1",
        group: "g1",
      } as never);

      const updatedReview: Record<string, unknown> = {};
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: () => ({
          create: async () => {
            throw new ClientResponseError({
              status: 400,
              response: {
                data: {
                  title: { code: "validation_not_unique", message: "Dup" },
                },
              },
            });
          },
          getFirstListItem: async () => ({
            id: "r1",
            reviewText: "Old text",
          }),
          update: async (_id: string, payload: Record<string, unknown>) => {
            Object.assign(updatedReview, payload);
            return payload;
          },
        }),
      } as never);

      const form = new FormData();
      form.set("rating", "4");
      form.set("reviewText", "");
      form.set("clearReviewText", "true");

      const res = await submitReview("t1", "g1", form);
      expect(res.success).toBe(true);
      expect(updatedReview.reviewText).toBeNull();
    });
  });

  describe("P2-5: Marginalia Unshare & Tag Cap", () => {
    it("toggleShareQuoteWithCircle allows unsharing from a circle after leaving it", async () => {
      spyOn(flagsServerModule, "requireFeature").mockResolvedValue(undefined as never);
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "u1",
        isAdmin: false,
      } as never);
      spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});
      const requireMembershipSpy = spyOn(
        membershipModule,
        "requireMembership",
      ).mockRejectedValue(new Error("Not a member of circle"));

      const savedCircles: string[] = [];
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        collection: () => ({
          getOne: async () => ({
            id: "q1",
            user: "u1",
            isSharedWithCircles: ["left_circle_1", "active_circle_2"],
          }),
          update: async (_id: string, data: { isSharedWithCircles: string[] }) => {
            savedCircles.push(...data.isSharedWithCircles);
            return {};
          },
        }),
      } as never);

      const res = await toggleShareQuoteWithCircle("q1", "left_circle_1");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isShared).toBe(false);
      }
      expect(savedCircles).toEqual(["active_circle_2"]);
      expect(requireMembershipSpy).not.toHaveBeenCalled();
    });

    it("parseTags caps tags at 20 items", () => {
      const manyTags = Array.from({ length: 30 }, (_, i) => `tag${i + 1}`);
      const parsed = parseTags(manyTags);
      expect(parsed).toHaveLength(20);
    });
  });
});
