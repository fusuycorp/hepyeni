import { describe, expect, it } from "bun:test";
import { projectActivityTitle } from "@/lib/activity";
import type {
  GroupsResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

// The activity feed previously shipped three things it should not: other
// members' review bodies, proposer identity in blind-pick circles, and email in
// the author expand. `projectActivityTitle` is the shipped projection, asserted
// directly here rather than re-implemented, so it cannot drift from the page.

const buildTitle = (overrides: {
  status?: string;
  isBlindPickEnabled?: boolean;
}): TitlesResponse<{ group?: GroupsResponse; addedBy?: UsersResponse }> =>
  ({
    id: "t1",
    group: "grp_1",
    title: "Dune",
    status: overrides.status ?? "proposed",
    createdAt: "2026-08-01T00:00:00Z",
    expand: {
      group: {
        id: "grp_1",
        name: "Test Circle",
        isBlindPickEnabled: overrides.isBlindPickEnabled ?? false,
      } as GroupsResponse,
      addedBy: {
        id: "u1",
        name: "Alice",
        email: "alice@secret.com",
        avatarUrl: "https://img.example/a.jpg",
      } as unknown as UsersResponse,
    },
  }) as TitlesResponse<{ group?: GroupsResponse; addedBy?: UsersResponse }>;

describe("activity title projection", () => {
  it("never lets the author email enter the payload (R2)", () => {
    const projected = projectActivityTitle(buildTitle({}), {
      isOwnerOrAdmin: true,
    });

    expect(projected.expand?.addedBy?.name).toBe("Alice");
    expect(
      (projected.expand?.addedBy as { email?: string } | undefined)?.email,
    ).toBeUndefined();
    // The narrowed shape keeps what the UI renders and nothing more.
    expect(projected.expand?.addedBy?.id).toBe("u1");
    expect(projected.expand?.addedBy?.avatarUrl).toBe(
      "https://img.example/a.jpg",
    );
  });

  it("hides the proposer in a blind-pick circle from a regular member", () => {
    const projected = projectActivityTitle(
      buildTitle({ isBlindPickEnabled: true }),
      { isOwnerOrAdmin: false },
    );

    expect(projected.expand?.addedBy).toBeUndefined();
  });

  it("still shows the proposer to an owner or admin of a blind-pick circle", () => {
    const projected = projectActivityTitle(
      buildTitle({ isBlindPickEnabled: true }),
      { isOwnerOrAdmin: true },
    );

    expect(projected.expand?.addedBy?.name).toBe("Alice");
  });

  it("does not redact a non-proposed title in a blind-pick circle", () => {
    // Matches the circle page, which only redacts the proposed bucket.
    const projected = projectActivityTitle(
      buildTitle({ isBlindPickEnabled: true, status: "consumed" }),
      { isOwnerOrAdmin: false },
    );

    expect(projected.expand?.addedBy?.name).toBe("Alice");
  });

  it("leaves an ordinary (non-blind-pick) title's author intact", () => {
    const projected = projectActivityTitle(buildTitle({}), {
      isOwnerOrAdmin: false,
    });

    expect(projected.expand?.addedBy?.id).toBe("u1");
  });
});
