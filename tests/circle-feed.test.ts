import { describe, expect, it, mock } from "bun:test";
import { fetchCircleFeed, fetchCircleTitleDetail } from "@/lib/queries/circle-feed";

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
    getFullList: mock((_opts?: any) => {
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

mock.module("@/lib/pocketbase/superuser", () => ({
  getSuperuserClient: () => Promise.resolve(mockPb),
}));

mock.module("@/lib/queries/schedules", () => ({
  getGroupSchedules: () => Promise.resolve([]),
}));

mock.module("@/lib/queries/progress", () => ({
  getTitleCircleProgress: () => Promise.resolve([]),
}));

describe("Circle Feed Deep Query Module", () => {
  it("fetches and partitions the complete circle feed", async () => {
    const session = { id: "u1", email: "alice@secret.com", name: "Alice", isAdmin: false };
    const feed = await fetchCircleFeed("grp_1", session);

    expect(feed.group.id).toBe("grp_1");
    expect(feed.access.isMember).toBe(true);
    expect(feed.proposed.length).toBe(1);
    expect(feed.proposed[0].title).toBe("Dune");
    expect(feed.proposed[0].score).toBe(1);
    expect(feed.proposed[0].userVote).toBe("up");

    // Invariant check: email must never be projected in addedBy or review users
    const addedBy = feed.proposed[0].expand?.addedBy as any;
    expect(addedBy?.email).toBeUndefined();
    expect(addedBy?.name).toBe("Alice");

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

  it("throws ACCESS_DENIED when private circle has no member session", async () => {
    // Override group getOne to return private group
    const privateMockPb = {
      ...mockPb,
      collection: (name: string) => ({
        ...mockPb.collection(name),
        getOne: mock(() => Promise.resolve({ id: "grp_private", isPublic: false })),
        getFirstListItem: mock(() => Promise.reject(new Error("not found"))),
      }),
    };

    mock.module("@/lib/pocketbase/superuser", () => ({
      getSuperuserClient: () => Promise.resolve(privateMockPb),
    }));

    await expect(fetchCircleFeed("grp_private", null)).rejects.toThrow("ACCESS_DENIED");
  });
});
