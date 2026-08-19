import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { ClientResponseError } from "pocketbase";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Invite System & Translations", () => {
  it("enforces complete invite translation key parity between English and Turkish", () => {
    const enKeys = Object.keys(en.invite).sort();
    const trKeys = Object.keys(tr.invite).sort();

    expect(enKeys).toEqual(trKeys);
    expect(enKeys.length).toBeGreaterThan(15);
  });

  it("contains non-empty translation strings for all invite keys", () => {
    for (const value of Object.values(en.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }

    for (const value of Object.values(tr.invite)) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it("contains enter invite code flow translation keys", () => {
    expect(en.invite.enterCodeTitle).toBe("Enter Invite Code");
    expect(tr.invite.enterCodeTitle).toBe("Davet Kodunu Girin");
    expect(en.invite.continueButton).toBe("Continue to Circle");
    expect(tr.invite.continueButton).toBe("Çembere Devam Et");
  });

  it("formats invite URLs correctly with code parameter", () => {
    const code = "ABC23456";
    const origin = "https://app.titirek.com";
    const expectedUrl = `${origin}/invite/${code}`;

    expect(new URL(`/invite/${code}`, origin).toString()).toBe(expectedUrl);
  });

  it("handles code casing and trimming", () => {
    const raw = "  abc23456  ";
    const normalized = raw.trim().toUpperCase();
    expect(normalized).toBe("ABC23456");
  });
});

// ---------------------------------------------------------------------------
// F-5: the public /invite/[code] preview (getGroupByInviteCode) must cap its
// proposed-backlog read instead of an unbounded getFullList. Exercised with a
// mocked superuser client so no PocketBase is needed.
// ---------------------------------------------------------------------------

const sessionModule = await import("@/lib/pocketbase/session");
const superuserModule = await import("@/lib/pocketbase/superuser");
const { getGroupByInviteCode } = await import("@/lib/actions/groups");

type InviteDb = {
  session: { id: string } | null;
  group: { id: string; name: string; inviteCode: string } | null;
  memberCount: number;
  consumedCount: number;
  proposed: Array<{
    id: string;
    title: string;
    creator?: string;
    mediaType: string;
    coverUrl?: string;
    createdAt: string;
  }>;
  membershipFound: boolean;
  titlesGetListCalls: Array<{ page: number; perPage: number; filter?: string }>;
  getFullListCalled: boolean;
};

const inviteDb: InviteDb = {
  session: null,
  group: null,
  memberCount: 0,
  consumedCount: 0,
  proposed: [],
  membershipFound: false,
  titlesGetListCalls: [],
  getFullListCalled: false,
};

function resetInviteDb() {
  inviteDb.session = null;
  inviteDb.group = null;
  inviteDb.memberCount = 0;
  inviteDb.consumedCount = 0;
  inviteDb.proposed = [];
  inviteDb.membershipFound = false;
  inviteDb.titlesGetListCalls = [];
  inviteDb.getFullListCalled = false;
}

function makeInvitePbClient() {
  return {
    filter: (expr: string, params: Record<string, unknown>) => {
      let out = expr;
      for (const [k, v] of Object.entries(params)) {
        out = out.replaceAll(`{:${k}}`, JSON.stringify(v));
      }
      return out;
    },
    collection: (name: string) => {
      if (name === "groups") {
        return {
          getFirstListItem: async () => {
            if (!inviteDb.group) {
              throw new ClientResponseError({
                url: "",
                status: 404,
                response: {},
              } as never);
            }
            return inviteDb.group;
          },
        };
      }
      if (name === "group_members") {
        return {
          getList: async () => ({
            items: [],
            totalItems: inviteDb.memberCount,
          }),
          getFirstListItem: async () => {
            if (!inviteDb.membershipFound) {
              throw new ClientResponseError({
                url: "",
                status: 404,
                response: {},
              } as never);
            }
            return { id: "member-1", group: inviteDb.group?.id, user: inviteDb.session?.id };
          },
        };
      }
      if (name === "titles") {
        return {
          getList: async (
            page: number,
            perPage: number,
            opts: { filter?: string } = {},
          ) => {
            inviteDb.titlesGetListCalls.push({ page, perPage, filter: opts.filter });
            if (opts.filter?.includes("proposed")) {
              return {
                items: inviteDb.proposed.slice(0, perPage),
                totalItems: inviteDb.proposed.length,
              };
            }
            return { items: [], totalItems: inviteDb.consumedCount };
          },
          // F-5 regression guard: the preview must never fall back to getFullList.
          getFullList: async () => {
            inviteDb.getFullListCalled = true;
            return inviteDb.proposed;
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("getGroupByInviteCode (F-5 — bounded invite preview)", () => {
  beforeEach(() => {
    resetInviteDb();
    spyOn(sessionModule, "getSession").mockImplementation(
      async () => inviteDb.session as never,
    );
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(
      makeInvitePbClient() as never,
    );
  });

  afterAll(() => {
    mock.restore();
  });

  it("caps the backlog preview at 20 rows but keeps the real proposedCount", async () => {
    inviteDb.group = { id: "group-1", name: "Sci-Fi Circle", inviteCode: "ABC1234" };
    inviteDb.memberCount = 7;
    inviteDb.consumedCount = 3;
    inviteDb.proposed = Array.from({ length: 25 }, (_, i) => ({
      id: `title-${i}`,
      title: `Title ${i}`,
      mediaType: "movie",
      createdAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const overview = await getGroupByInviteCode("abc1234");

    expect(overview).not.toBeNull();
    expect(overview?.proposedTitles.length).toBe(20);
    expect(overview?.proposedCount).toBe(25);
    expect(overview?.memberCount).toBe(7);
    expect(overview?.consumedCount).toBe(3);

    const proposedCalls = inviteDb.titlesGetListCalls.filter((c) =>
      c.filter?.includes("proposed"),
    );
    expect(proposedCalls.length).toBeGreaterThan(0);
    for (const call of proposedCalls) {
      expect(call.perPage).toBe(20);
    }
    expect(inviteDb.getFullListCalled).toBe(false);
  });

  it("runs on the public page with no authenticated session", async () => {
    inviteDb.session = null;
    inviteDb.group = { id: "group-2", name: "Public Circle", inviteCode: "XYZ99" };
    inviteDb.proposed = [{ id: "t1", title: "Only", mediaType: "book", createdAt: "2026-01-01T00:00:00.000Z" }];

    const overview = await getGroupByInviteCode("XYZ99");

    expect(overview).not.toBeNull();
    expect(overview?.proposedTitles).toHaveLength(1);
    expect(overview?.isMember).toBe(false);
  });
});
