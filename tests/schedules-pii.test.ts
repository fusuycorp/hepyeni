import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as superuserModule from "@/lib/pocketbase/superuser";
import * as errorsModule from "@/lib/errors";

// A schedule whose expanded creator carries the full PocketBase user record.
// `creator` is projected to PublicUser, but the raw `expand` block must not
// ride along on the returned object: this array is handed to the "use client"
// GroupSchedulesCard, so anything left on it is serialised into the RSC
// payload for every viewer of the circle — including public-circle guests.
const CREATOR_EMAIL = "creator@secret.example";

const mockPb = {
  filter: (str: string, params: Record<string, unknown>) => {
    let res = str;
    for (const [k, v] of Object.entries(params)) {
      res = res.replace(`{:${k}}`, String(v));
    }
    return res;
  },
  collection: (name: string) => ({
    getFullList: mock(() => {
      if (name === "group_schedules") {
        return Promise.resolve([
          {
            id: "s1",
            group: "grp_1",
            name: "Autumn Pace",
            startDate: "2026-09-01",
            targetDate: "2026-12-01",
            createdAt: "2026-09-01T00:00:00Z",
            expand: {
              title: { id: "t1", title: "Dune" },
              createdBy: {
                id: "u1",
                name: "Alice",
                email: CREATOR_EMAIL,
                emailVisibility: true,
                verified: true,
                isAdmin: false,
              },
            },
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  }),
};

describe("Group schedules — expand must not leak the creator record", () => {
  beforeEach(() => {
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(mockPb as never);
    spyOn(errorsModule, "logDiagnostic").mockReturnValue({ traceId: "test" } as never);
  });

  afterAll(() => {
    mock.restore();
  });

  it("strips the raw expand block and never ships the creator's email", async () => {
    const { getGroupSchedules } = await import("@/lib/queries/schedules");
    const access = {
      isMember: true,
      isOwner: false,
      isAdmin: false,
      canViewBacklog: true,
      canViewFinished: true,
      canViewReviews: true,
      canViewComments: true,
    } as never;

    const schedules = await getGroupSchedules("grp_1", {
      id: "u2",
      email: "bob@example.com",
      name: "Bob",
      isAdmin: false,
    } as never, access);

    expect(schedules.length).toBe(1);

    // The projected creator is fine.
    expect(schedules[0].creator?.name).toBe("Alice");
    expect(schedules[0].creator as Record<string, unknown>).not.toHaveProperty("email");

    // ...but spreading the record must not re-introduce it through `expand`.
    expect(
      (schedules[0] as unknown as { expand?: unknown }).expand,
    ).toBeUndefined();
    expect(JSON.stringify(schedules)).not.toContain(CREATOR_EMAIL);
    expect(JSON.stringify(schedules)).not.toContain("emailVisibility");
  });
});
