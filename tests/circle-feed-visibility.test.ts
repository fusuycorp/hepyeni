import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { fetchCircleFeed } from "@/lib/queries/circle-feed";
import * as superuserModule from "@/lib/pocketbase/superuser";
import * as schedulesModule from "@/lib/queries/schedules";
import * as progressModule from "@/lib/queries/progress";

// `isSharedWithCircles` is the user-facing "Share Live Progress with Circles"
// privacy opt-out. The title-detail consumer honored it but the circle feed did
// not, so an opted-out member's progress rows still drove categorizeCircleTitles
// — making them visible in In Progress counts/avatars and letting them move a
// title out of Up Next. These tests drive the real loader so a future divergence
// on either side of that seam fails here.

const buildMockPb = (isSharedWithCircles: boolean) => ({
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
          title: "Dune",
          status: "proposed",
          createdAt: "2026-08-01T00:00:00Z",
          expand: { votes_via_title: [] },
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
            expand: { user: { id: "u1", name: "Alice" } },
          },
          {
            id: "gm_2",
            group: "grp_1",
            user: "u2",
            role: "member",
            expand: { user: { id: "u2", name: "Bob" } },
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
              addedBy: { id: "u1", name: "Alice" },
              votes_via_title: [],
            },
          },
        ]);
      }
      if (name === "user_media_progress") {
        return Promise.resolve([
          {
            id: "p2",
            user: "u2",
            groupTitle: "t1",
            status: "in_progress",
            progressCurrent: 10,
            progressTotal: 100,
            progressUnit: "pages",
            isSharedWithCircles,
            updatedAt: "2026-08-02T00:00:00Z",
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  }),
});

const viewer = {
  id: "u1",
  email: "alice@example.com",
  name: "Alice",
  isAdmin: false,
};

describe("Circle feed progress-visibility seam", () => {
  beforeEach(() => {
    spyOn(schedulesModule, "getGroupSchedules").mockResolvedValue([] as never);
    spyOn(progressModule, "getTitleCircleProgress").mockResolvedValue(
      [] as never,
    );
  });

  afterAll(() => {
    mock.restore();
  });

  it("keeps a title in Up Next when the only progress row is opted out", async () => {
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
      buildMockPb(false) as never,
    );

    const feed = await fetchCircleFeed("grp_1", viewer);

    // Before the fix, u2's opted-out row was still counted, so the single
    // title was partitioned into In Progress and Up Next came back empty.
    expect(feed.proposed.length).toBe(1);
    expect(feed.proposed[0].id).toBe("t1");
  });

  it("still moves the title once the member shares their progress", async () => {
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
      buildMockPb(true) as never,
    );

    const feed = await fetchCircleFeed("grp_1", viewer);

    // Control: the same row DOES count when shared, so the test above is
    // proving the flag is honored rather than the row being ignored entirely.
    expect(feed.proposed.length).toBe(0);
  });
});
