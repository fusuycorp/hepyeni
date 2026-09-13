import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ClientResponseError } from "pocketbase";
import { fetchCircleFeed, fetchCircleTitleDetail } from "@/lib/queries/circle-feed";
import * as superuserModule from "@/lib/pocketbase/superuser";
import * as schedulesModule from "@/lib/queries/schedules";
import * as progressModule from "@/lib/queries/progress";

// Mock pocketbase superuser and session modules
const mockPb = {
  filter: (str: string, params: Record<string, unknown>) => {
    let res = str;
    for (const [k, v] of Object.entries(params)) {
      res = res.replace(`{:${k}}`, String(v));
    }
    return res;
  },
  collection: (name: string) => ({
    getOne: mock((id: string) => {
      if (name === "groups") {
        return Promise.resolve({
          id,
          name: "Test Circle",
          isPublic: true,
          isBlindPickEnabled: false,
        });
      }
      if (name === "titles") {
        return Promise.resolve({
          id,
          group: "grp_1",
          title: "The Hobbit",
          creator: "J.R.R. Tolkien",
          status: "proposed",
          createdAt: "2026-08-01T00:00:00Z",
          expand: {
            votes_via_title: [{ id: "v1", title: id, user: "u1", value: "up" }],
          },
        });
      }
      return Promise.resolve({ id });
    }),
    getFirstListItem: mock(() => {
      if (name === "group_members") {
        return Promise.resolve({
          id: "gm_1",
          group: "grp_1",
          user: "u1",
          role: "member",
        });
      }
      return Promise.resolve({ id: "rec_1" });
    }),
    getFullList: mock(() => {
      if (name === "group_members") {
        return Promise.resolve([
          {
            id: "gm_1",
            group: "grp_1",
            user: "u1",
            role: "member",
            expand: { user: { id: "u1", name: "Alice", email: "alice@secret.com" } },
          },
        ]);
      }
      if (name === "titles") {
        return Promise.resolve([
          {
            id: "t1",
            group: "grp_1",
            title: "Dune",
            status: "proposed",
            createdAt: "2026-08-01T00:00:00Z",
            expand: {
              addedBy: { id: "u1", name: "Alice", email: "alice@secret.com" },
              votes_via_title: [{ id: "v1", title: "t1", user: "u1", value: "up" }],
            },
          },
        ]);
      }
      if (name === "comments") {
        return Promise.resolve([
          {
            id: "c1",
            title: "t1",
            group: "grp_1",
            content: "Great read!",
            createdAt: "2026-08-01T01:00:00Z",
            expand: { user: { id: "u1", name: "Alice", email: "alice@secret.com" } },
          },
        ]);
      }
      if (name === "reviews") {
        return Promise.resolve([
          {
            id: "r1",
            title: "t1",
            user: "u1",
            rating: 5,
            reviewText: "Masterpiece",
            createdAt: "2026-08-01T02:00:00Z",
            expand: { user: { id: "u1", name: "Alice", email: "alice@secret.com" } },
          },
        ]);
      }
      if (name === "user_media_progress") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
  }),
};

describe("Circle Feed Deep Query Module", () => {
  beforeEach(() => {
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(mockPb as never);
    spyOn(schedulesModule, "getGroupSchedules").mockResolvedValue([] as never);
    spyOn(progressModule, "getTitleCircleProgress").mockResolvedValue([] as never);
  });

  afterAll(() => {
    mock.restore();
  });

  it("fetches and partitions the complete circle feed", async () => {
    const session = { id: "u1", email: "alice@secret.com", name: "Alice", isAdmin: false };
    const feed = await fetchCircleFeed("grp_1", session);

    expect(feed.group.id).toBe("grp_1");
    expect(feed.access.isMember).toBe(true);
    expect(feed.proposed.length).toBe(1);
    expect(feed.proposed[0].title).toBe("Dune");
    expect(feed.proposed[0].score).toBe(1);
    expect(feed.proposed[0].userVote).toBe("up");

    // Invariant check: email must never be projected in addedBy, review users, or members (R2 invariant)
    const addedBy = feed.proposed[0].expand?.addedBy as any;
    expect(addedBy?.email).toBeUndefined();
    expect(addedBy?.name).toBe("Alice");

    expect((feed.members[0].expand?.user as any)?.email).toBeUndefined();
    expect(feed.members[0].expand?.user?.name).toBe("Alice");

    // Domain lifecycle aliases per ADR-015
    expect(feed.upNext).toBe(feed.proposed);
    expect(feed.finished).toBe(feed.consumed);
  });

  it("redacts proposed title author identity when blind pick is enabled for non-owner/non-admin", async () => {
    const blindPickMockPb = {
      ...mockPb,
      collection: (name: string) => ({
        ...mockPb.collection(name),
        getOne: mock((id: string) => {
          if (name === "groups") {
            return Promise.resolve({
              id,
              name: "Blind Pick Circle",
              isPublic: true,
              isBlindPickEnabled: true,
            });
          }
          return mockPb.collection(name).getOne(id);
        }),
      }),
    };

    mock.module("@/lib/pocketbase/superuser", () => ({
      getSuperuserClient: () => Promise.resolve(blindPickMockPb),
    }));

    const session = { id: "u2", email: "bob@example.com", name: "Bob", isAdmin: false };
    const feed = await fetchCircleFeed("grp_1", session);

    expect(feed.proposed.length).toBe(1);
    const addedBy = feed.proposed[0].expand?.addedBy;
    expect(addedBy).toBeUndefined(); // Blind pick strips author identity for non-owner
  });

  it("redacts proposer identity on the inProgress list too, not only the backlog", async () => {
    // A proposal being actively consumed is categorised into `inProgress` while
    // its title status is still "proposed". Before this was fixed, redaction was
    // applied only to `proposed`, so a blind-pick circle withheld the proposer
    // on Up Next and disclosed it the moment consumption started (ADR-012).
    const consumedProposalPb = {
      ...mockPb,
      collection: (name: string) => ({
        ...mockPb.collection(name),
        getOne: mock((id: string) => {
          if (name === "groups") {
            return Promise.resolve({
              id,
              name: "Blind Pick Circle",
              isPublic: true,
              isBlindPickEnabled: true,
            });
          }
          return mockPb.collection(name).getOne(id);
        }),
        getFullList: mock((...args: unknown[]) => {
          if (name === "titles") {
            return Promise.resolve([
              {
                id: "t2",
                group: "grp_1",
                title: "Dune Messiah",
                status: "proposed",
                createdAt: "2026-08-02T00:00:00Z",
                expand: {
                  addedBy: { id: "u1", name: "Alice", email: "alice@secret.com" },
                  votes_via_title: [],
                },
              },
            ]);
          }
          // Any member has in-progress rows, which is what moves the still-
          // "proposed" title into the inProgress bucket.
          if (name === "user_media_progress") {
            return Promise.resolve([
              {
                id: "p1",
                user: "u1",
                // Rows are keyed by the `groupTitle` relation, not `title`.
                groupTitle: "t2",
                status: "in_progress",
                progressCurrent: 10,
                progressTotal: 100,
                progressUnit: "pages",
                isSharedWithCircles: true,
                updatedAt: "2026-08-02T01:00:00Z",
              },
            ]);
          }
          return (mockPb.collection(name).getFullList as (a?: unknown) => unknown)(...args);
        }),
      }),
    };

    mock.module("@/lib/pocketbase/superuser", () => ({
      getSuperuserClient: () => Promise.resolve(consumedProposalPb),
    }));

    const session = { id: "u2", email: "bob@example.com", name: "Bob", isAdmin: false };
    const feed = await fetchCircleFeed("grp_1", session);

    // The title left the backlog and is now in progress.
    expect(feed.proposed.length).toBe(0);
    expect(feed.inProgress.length).toBe(1);
    expect(feed.inProgress[0].title).toBe("Dune Messiah");

    // ...and its proposer identity must be redacted there too.
    expect(feed.inProgress[0].expand?.addedBy).toBeUndefined();
    expect(JSON.stringify(feed.inProgress)).not.toContain("alice@secret.com");
    expect(JSON.stringify(feed.inProgress)).not.toContain("Alice");
  });

  it("redacts proposer identity on the consumed (finished) list too", async () => {
    // The mirror case: once every member has finished, the title moves to
    // `consumed`. `consumed` is redacted defensively for exactly this reason,
    // so pin it — an untested defensive redaction is indistinguishable from
    // no redaction the next time this code is refactored.
    const finishedProposalPb = {
      ...mockPb,
      collection: (name: string) => ({
        ...mockPb.collection(name),
        getOne: mock((id: string) => {
          if (name === "groups") {
            return Promise.resolve({
              id,
              name: "Blind Pick Circle",
              isPublic: true,
              isBlindPickEnabled: true,
            });
          }
          return mockPb.collection(name).getOne(id);
        }),
        getFullList: mock((...args: unknown[]) => {
          if (name === "titles") {
            return Promise.resolve([
              {
                id: "t2",
                group: "grp_1",
                title: "Dune Messiah",
                status: "proposed",
                consumedAt: "2026-08-05T00:00:00Z",
                createdAt: "2026-08-02T00:00:00Z",
                expand: {
                  addedBy: {
                    id: "u1",
                    name: "Alice",
                    email: "alice@secret.com",
                  },
                  votes_via_title: [],
                },
              },
            ]);
          }
          // The single member has completed, so every member is finished and
          // the title is categorised as `consumed`.
          if (name === "user_media_progress") {
            return Promise.resolve([
              {
                id: "p1",
                user: "u1",
                groupTitle: "t2",
                status: "completed",
                progressCurrent: 100,
                progressTotal: 100,
                progressUnit: "pages",
                isSharedWithCircles: true,
                updatedAt: "2026-08-05T01:00:00Z",
              },
            ]);
          }
          return (
            mockPb.collection(name).getFullList as (a?: unknown) => unknown
          )(...args);
        }),
      }),
    };

    mock.module("@/lib/pocketbase/superuser", () => ({
      getSuperuserClient: () => Promise.resolve(finishedProposalPb),
    }));

    const session = { id: "u2", email: "bob@example.com", name: "Bob", isAdmin: false };
    const feed = await fetchCircleFeed("grp_1", session);

    expect(feed.consumed.length).toBe(1);
    expect(feed.consumed[0].title).toBe("Dune Messiah");
    expect(feed.consumed[0].expand?.addedBy).toBeUndefined();
    expect(JSON.stringify(feed.consumed)).not.toContain("alice@secret.com");
    expect(JSON.stringify(feed.consumed)).not.toContain("Alice");
  });

  it("fetches title details with comment and review PII stripped", async () => {
    const session = { id: "u1", email: "alice@secret.com", name: "Alice", isAdmin: false };
    const detail = await fetchCircleTitleDetail("grp_1", "t1", session);

    expect(detail.title.id).toBe("t1");
    expect(detail.title.score).toBe(1);
    expect(detail.comments.length).toBe(1);
    expect(detail.comments[0].content).toBe("Great read!");

    // Comment user must NOT have email
    const commentUser = detail.comments[0].expand?.user as any;
    expect(commentUser?.email).toBeUndefined();
    expect(commentUser?.name).toBe("Alice");
  });

  it("throws ACCESS_DENIED when private circle has no member session or non-member session", async () => {
    // Override group getOne to return private group
    const privateMockPb = {
      ...mockPb,
      collection: (name: string) => ({
        ...mockPb.collection(name),
        getOne: mock(() => Promise.resolve({ id: "grp_private", isPublic: false })),
        getFirstListItem: mock(() => Promise.reject(new ClientResponseError({ status: 404 }))),
      }),
    };

    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(privateMockPb as never);

    await expect(fetchCircleFeed("grp_private", null)).rejects.toThrow("ACCESS_DENIED");

    const nonMemberSession = { id: "u2", email: "bob@test.com", name: "Bob", isAdmin: false };
    await expect(fetchCircleFeed("grp_private", nonMemberSession)).rejects.toThrow("ACCESS_DENIED");
  });
});
