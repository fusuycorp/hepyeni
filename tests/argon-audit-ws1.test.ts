import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { readFileSync } from "node:fs";
import { ClientResponseError } from "pocketbase";
import { evaluateCircleAccess, resolveCircleAccess } from "@/lib/membership";
import { checkRateLimit, getClientIp, resetRateLimits } from "@/lib/rate-limit";
import * as sessionModule from "@/lib/pocketbase/session";
import * as superuserModule from "@/lib/pocketbase/superuser";
import { requireAdmin } from "@/lib/admin";
import { buildIdListFilter } from "@/lib/admin-groups";
import { getGroupByInviteCode } from "@/lib/queries/groups";
import { createGroup } from "@/lib/actions/groups";
import { deleteAccount } from "@/lib/actions/profile";
import { adminRemoveGroupMember } from "@/lib/actions/admin";
import type {
  GroupGuestSettings,
  GroupsResponse,
} from "@/types/pocketbase-types";

function makeGroup(overrides: Partial<GroupsResponse> = {}): GroupsResponse {
  return {
    id: "grp_test_1",
    name: "Test Circle",
    inviteCode: "SECRET99",
    createdBy: "usr_owner",
    isPublic: true,
    isBlindPickEnabled: false,
    guestSettings: null,
    createdAt: "2026-08-17T12:00:00.000Z" as never,
    collectionId: "col_groups",
    collectionName: "groups",
    ...overrides,
  };
}

describe("Argon Audit Remediation — Workstream 1", () => {
  afterEach(() => {
    mock.restore();
    resetRateLimits();
  });

  afterAll(() => {
    mock.restore();
  });

  // =========================================================================
  // 1. P0-1 & P2-6: src/lib/membership.ts
  // =========================================================================
  describe("1. P0-1 & P2-6: evaluateCircleAccess & resolveCircleAccess", () => {
    it("redacts inviteCode on group when viewer is a guest (!membership)", () => {
      const pubGroup = makeGroup({ isPublic: true, inviteCode: "TOPSECRET" });
      const privGroup = makeGroup({ isPublic: false, inviteCode: "PRIVSECRET" });

      const pubGuest = evaluateCircleAccess(pubGroup, null);
      expect(pubGuest.isGuest).toBe(true);
      expect(pubGuest.group.inviteCode).toBe("");

      const privGuest = evaluateCircleAccess(privGroup, null);
      expect(privGuest.isGuest).toBe(true);
      expect(privGuest.group.inviteCode).toBe("");
    });

    it("preserves inviteCode for authenticated circle members", () => {
      const group = makeGroup({ inviteCode: "MEMBERCODE" });
      const access = evaluateCircleAccess(group, {
        id: "mem_1",
        group: group.id,
        user: "usr_1",
        role: "member",
        joinedAt: "2026-08-17T12:00:00.000Z" as never,
        collectionId: "col_gm",
        collectionName: "group_members",
      });
      expect(access.isMember).toBe(true);
      expect(access.group.inviteCode).toBe("MEMBERCODE");
    });

    it("forces all mutation permissions to false when guest is unauthenticated", () => {
      const permissive: GroupGuestSettings = {
        visibility: {
          backlog: true,
          finished: true,
          reviews: true,
          comments: true,
        },
        permissions: {
          canVote: true,
          canComment: true,
          canReview: true,
          canPropose: true,
        },
      };
      const group = makeGroup({ isPublic: true, guestSettings: permissive });

      const unauthAccess = evaluateCircleAccess(group, null, false);
      expect(unauthAccess.canVote).toBe(false);
      expect(unauthAccess.canComment).toBe(false);
      expect(unauthAccess.canReview).toBe(false);
      expect(unauthAccess.canPropose).toBe(false);

      const authAccess = evaluateCircleAccess(group, null, true);
      expect(authAccess.canVote).toBe(true);
      expect(authAccess.canComment).toBe(true);
      expect(authAccess.canReview).toBe(true);
      expect(authAccess.canPropose).toBe(true);
    });

    it("intersects guest mutation permissions with section visibility", () => {
      const hiddenSectionsWithPerms: GroupGuestSettings = {
        visibility: {
          backlog: false,
          finished: true,
          reviews: false,
          comments: false,
        },
        permissions: {
          canVote: true,
          canPropose: true,
          canReview: true,
          canComment: true,
        },
      };
      const group = makeGroup({
        isPublic: true,
        guestSettings: hiddenSectionsWithPerms,
      });

      const access = evaluateCircleAccess(group, null, true);
      expect(access.canVote).toBe(false);
      expect(access.canPropose).toBe(false);
      expect(access.canReview).toBe(false);
      expect(access.canComment).toBe(false);
    });

    it("resolveCircleAccess passes Boolean(userId) for unauthenticated callers", async () => {
      const permissive: GroupGuestSettings = {
        visibility: {
          backlog: true,
          finished: true,
          reviews: true,
          comments: true,
        },
        permissions: {
          canVote: true,
          canComment: true,
          canReview: true,
          canPropose: true,
        },
      };
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (s: string) => s,
        collection: (name: string) => {
          if (name === "groups") {
            return {
              getOne: async () =>
                makeGroup({
                  isPublic: true,
                  inviteCode: "LEAKME",
                  guestSettings: permissive,
                }),
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const access = await resolveCircleAccess("grp_test_1", undefined);
      expect(access.group.inviteCode).toBe("");
      expect(access.canVote).toBe(false);
      expect(access.canPropose).toBe(false);
      expect(access.canReview).toBe(false);
      expect(access.canComment).toBe(false);
    });
  });

  // =========================================================================
  // 2. P0-1: src/lib/queries/groups.ts
  // =========================================================================
  describe("2. P0-1: getGroupByInviteCode backlog visibility gate", () => {
    it("returns empty proposedTitles for non-members when guestSettings.visibility.backlog is false", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue(null);
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "groups") {
            return {
              getFirstListItem: async () =>
                makeGroup({
                  id: "grp_hidden_backlog",
                  inviteCode: "HIDEME",
                  guestSettings: {
                    visibility: {
                      backlog: false,
                      finished: true,
                      reviews: true,
                      comments: true,
                    },
                    permissions: {
                      canVote: false,
                      canComment: false,
                      canReview: false,
                      canPropose: false,
                    },
                  },
                }),
            };
          }
          if (name === "group_members") {
            return {
              getList: async () => ({ items: [], totalItems: 3 }),
            };
          }
          if (name === "titles") {
            return {
              getList: async (
                _p: number,
                _pp: number,
                opts?: { filter?: string },
              ) => {
                if (opts?.filter?.includes("proposed")) {
                  return {
                    items: [
                      {
                        id: "t_secret",
                        title: "Hidden Backlog Title",
                        mediaType: "movie",
                        createdAt: "2026-01-01T00:00:00Z",
                      },
                    ],
                    totalItems: 1,
                  };
                }
                return { items: [], totalItems: 0 };
              },
            };
          }
          throw new Error(`Unexpected collection ${name}`);
        },
      } as never);

      const res = await getGroupByInviteCode("HIDEME");
      expect(res).not.toBeNull();
      expect(res?.proposedTitles).toEqual([]);
    });
  });

  // =========================================================================
  // 3. P0-4, P1-2, P1-12, P2-14, P2-17: Auth & OAuth2 Callback
  // =========================================================================
  describe("3. Auth & OAuth2 Callback Hardening", () => {
    it("sets emailVisibility: false in signInWithEmail and signUpWithPassword and guards OTP/reset/invite flows", () => {
      const authSource = readFileSync("src/lib/actions/auth.ts", "utf-8");
      expect(authSource).not.toContain("emailVisibility: true");
      expect(authSource).toContain("emailVisibility: false");
      expect(authSource).toContain("peekOtpCookie");
      expect(authSource).toContain("InvalidEmail");
      expect(authSource).toContain("token.slice(0, 64)");
      expect(authSource).toContain("/reset-password?error=InvalidPassword");

      const oauthCallbackSource = readFileSync(
        "src/app/api/auth/oauth2-callback/route.ts",
        "utf-8",
      );
      expect(oauthCallbackSource).toContain("oauth2-callback:autoJoinPendingInvite");
    });

    it("signInWithEmail rethrows non-404 lookup errors and redirects InvalidEmail on 400 invalid email", async () => {
      const { signInWithEmail } = await import("@/lib/actions/auth");

      // 1. Non-404 error from getFirstListItem is rethrown
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (s: string) => s,
        collection: () => ({
          getFirstListItem: async () => {
            throw new ClientResponseError({ status: 500 });
          },
        }),
      } as never);

      const fd1 = new FormData();
      fd1.set("email", "user@example.com");
      await expect(signInWithEmail(fd1)).rejects.toThrow();

      // 2. 404 lookup + 400 non-unique error on create redirects /login?error=InvalidEmail
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (s: string) => s,
        collection: () => ({
          getFirstListItem: async () => {
            throw new ClientResponseError({ status: 404 });
          },
          create: async () => {
            throw new ClientResponseError({
              status: 400,
              response: {
                data: {
                  email: { code: "validation_is_email", message: "Invalid email" },
                },
              },
            });
          },
        }),
      } as never);

      const fd2 = new FormData();
      fd2.set("email", "not-an-email");
      try {
        await signInWithEmail(fd2);
        expect.unreachable("Should have redirected");
      } catch (err) {
        expect(String((err as { digest?: string }).digest ?? err)).toContain(
          "/login?error=InvalidEmail",
        );
      }
    });

    it("signUpWithPassword sends OTP and redirects to /login?step=code when existing account is unverified", async () => {
      const { signUpWithPassword } = await import("@/lib/actions/auth");
      const PocketBase = (await import("pocketbase")).default;

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (s: string) => s,
        collection: () => ({
          create: async () => {
            throw new ClientResponseError({
              status: 400,
              response: {
                data: {
                  email: { code: "validation_not_unique", message: "Must be unique" },
                },
              },
            });
          },
          getFirstListItem: async () => ({
            id: "usr_squatted",
            email: "victim@example.com",
            verified: false,
          }),
        }),
      } as never);

      let otpCookieSaved = null as { email: string; otpId: string } | null;
      spyOn(sessionModule, "setOtpCookie").mockImplementation(async (data) => {
        otpCookieSaved = data;
      });
      spyOn(PocketBase.prototype, "collection").mockReturnValue({
        requestOTP: async () => ({ otpId: "otp_recovery_123" }),
      } as never);

      const fd = new FormData();
      fd.set("email", "victim@example.com");
      fd.set("password", "ValidPassword123!");

      try {
        await signUpWithPassword(fd);
        expect.unreachable("Should have redirected");
      } catch (err) {
        expect(String((err as { digest?: string }).digest ?? err)).toContain(
          "/login?step=code",
        );
      }
      expect(otpCookieSaved).toEqual({
        email: "victim@example.com",
        otpId: "otp_recovery_123",
      });
    });

    it("verifyEmailCode peeks OTP cookie before authWithOTP and preserves cookie on typo", async () => {
      const { verifyEmailCode } = await import("@/lib/actions/auth");
      const PocketBase = (await import("pocketbase")).default;

      let consumed = false;
      spyOn(sessionModule, "peekOtpCookie").mockResolvedValue({
        email: "user@example.com",
        otpId: "otp_123",
      });
      spyOn(sessionModule, "consumeOtpCookie").mockImplementation(async () => {
        consumed = true;
        return { email: "user@example.com", otpId: "otp_123" };
      });
      spyOn(PocketBase.prototype, "collection").mockReturnValue({
        authWithOTP: async () => {
          throw new ClientResponseError({ status: 400 });
        },
      } as never);

      const fd = new FormData();
      fd.set("code", "000000");
      try {
        await verifyEmailCode(fd);
        expect.unreachable("Should have redirected");
      } catch (err) {
        expect(String((err as { digest?: string }).digest ?? err)).toContain(
          "/login?error=InvalidCode",
        );
      }
      expect(consumed).toBe(false);
    });

    it("confirmPasswordReset rejects passwords longer than 128 characters", async () => {
      const { confirmPasswordReset } = await import("@/lib/actions/auth");
      const fd = new FormData();
      fd.set("token", "reset_tok_123");
      const overlong = "A".repeat(129);
      fd.set("password", overlong);
      fd.set("passwordConfirm", overlong);

      try {
        await confirmPasswordReset(fd);
        expect.unreachable("Should have redirected");
      } catch (err) {
        expect(String((err as { digest?: string }).digest ?? err)).toContain(
          "/reset-password?error=InvalidPassword",
        );
      }
    });
  });

  // =========================================================================
  // 4. P0-5 & P2-13: deleteAccount, createGroup, adminRemoveGroupMember
  // =========================================================================
  describe("4. P0-5 & P2-13: Account Deletion, Orphan Group Rollback & Sole Owner Guard", () => {
    it("deleteAccount transfers multi-member owned groups, deletes sole-owner groups, and reassigns titles/schedules", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_leaving",
        email: "leave@example.com",
        name: "Leaving",
        isAdmin: false,
      });
      spyOn(sessionModule, "clearSessionCookie").mockResolvedValue();

      const updatedGroups: Array<{ id: string; data: Record<string, unknown> }> = [];
      const deletedGroups: string[] = [];
      const updatedMembers: Array<{ id: string; data: Record<string, unknown> }> = [];
      const updatedTitles: Array<{ id: string; data: Record<string, unknown> }> = [];
      const updatedSchedules: Array<{ id: string; data: Record<string, unknown> }> = [];
      const deletedUsers: string[] = [];

      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
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
              getFullList: async () => [
                { id: "grp_shared", createdBy: "usr_leaving" },
                { id: "grp_solo", createdBy: "usr_leaving" },
              ],
              getOne: async (id: string) => {
                if (id === "grp_shared") {
                  return { id: "grp_shared", createdBy: "usr_successor" };
                }
                throw new ClientResponseError({ status: 404 });
              },
              update: async (id: string, data: Record<string, unknown>) => {
                updatedGroups.push({ id, data });
              },
              delete: async (id: string) => {
                deletedGroups.push(id);
              },
            };
          }
          if (name === "group_members") {
            return {
              getFullList: async ({ filter }: { filter?: string } = {}) => {
                if (filter?.includes('"grp_shared"')) {
                  return [
                    {
                      id: "mem_succ",
                      group: "grp_shared",
                      user: "usr_successor",
                      role: "member",
                    },
                  ];
                }
                return [];
              },
              update: async (id: string, data: Record<string, unknown>) => {
                updatedMembers.push({ id, data });
              },
            };
          }
          if (name === "titles") {
            return {
              getFullList: async () => [
                { id: "ttl_1", group: "grp_shared", addedBy: "usr_leaving" },
              ],
              update: async (id: string, data: Record<string, unknown>) => {
                updatedTitles.push({ id, data });
              },
              delete: async () => {},
            };
          }
          if (name === "group_schedules") {
            return {
              getFullList: async () => [
                { id: "sch_1", group: "grp_shared", createdBy: "usr_leaving" },
              ],
              update: async (id: string, data: Record<string, unknown>) => {
                updatedSchedules.push({ id, data });
              },
              delete: async () => {},
            };
          }
          if (name === "users") {
            return {
              delete: async (id: string) => {
                deletedUsers.push(id);
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const res = await deleteAccount();
      expect(res.success).toBe(true);
      expect(updatedMembers).toEqual([
        { id: "mem_succ", data: { role: "owner" } },
      ]);
      expect(updatedGroups).toEqual([
        { id: "grp_shared", data: { createdBy: "usr_successor" } },
      ]);
      expect(deletedGroups).toEqual(["grp_solo"]);
      expect(updatedTitles).toEqual([
        { id: "ttl_1", data: { addedBy: "usr_successor" } },
      ]);
      expect(updatedSchedules).toEqual([
        { id: "sch_1", data: { createdBy: "usr_successor" } },
      ]);
      expect(deletedUsers).toEqual(["usr_leaving"]);
    });

    it("createGroup rolls back and deletes the created group if group_members.create fails", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_creator",
        email: "creator@example.com",
        name: "Creator",
        isAdmin: false,
      });

      const deletedGroupIds: string[] = [];
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        collection: (name: string) => {
          if (name === "groups") {
            return {
              create: async () => ({ id: "grp_orphan_1", name: "Orphan" }),
              delete: async (id: string) => {
                deletedGroupIds.push(id);
              },
            };
          }
          if (name === "group_members") {
            return {
              create: async () => {
                throw new Error("DB failure creating owner membership");
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const fd = new FormData();
      fd.set("name", "My New Circle");
      const res = await createGroup(fd);
      expect(res.success).toBe(false);
      expect(deletedGroupIds).toEqual(["grp_orphan_1"]);
    });

    it("adminRemoveGroupMember refuses to remove the sole owner of a group", async () => {
      spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        email: "admin@example.com",
        name: "Admin",
        isAdmin: true,
      });

      let deletedMemberId: string | null = null;
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        filter: (expr: string) => expr,
        collection: (name: string) => {
          if (name === "users") {
            return {
              getOne: async () => ({
                id: "usr_admin",
                isAdmin: true,
                bannedAt: null,
              }),
            };
          }
          if (name === "group_members") {
            return {
              getFirstListItem: async () => ({
                id: "mem_owner_1",
                group: "grp_1",
                user: "usr_owner",
                role: "owner",
              }),
              getList: async () => ({ items: [], totalItems: 0 }),
              delete: async (id: string) => {
                deletedMemberId = id;
              },
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as never);

      const res = await adminRemoveGroupMember("grp_1", "usr_owner");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(
          "Cannot remove the sole owner of a group. Delete the group instead.",
        );
      }
      expect(deletedMemberId).toBeNull();
    });
  });

  // =========================================================================
  // 5. P1-11: src/lib/rate-limit.ts
  // =========================================================================
  describe("5. P1-11: Rate Limiter Cross-Window Isolation, Cap & Client IP", () => {
    it("preserves long-window timestamps when pruning is triggered by a short-window call", () => {
      const t0 = 1_000_000;
      // Record a 1-hour window entry at t0
      checkRateLimit("long-lived", { limit: 1, windowMs: 3_600_000 }, t0);

      // Populate > 2000 short-window entries to trigger store pruning at t0 + 5_000
      for (let i = 0; i < 2005; i++) {
        checkRateLimit(`short-${i}`, { limit: 5, windowMs: 1_000 }, t0 + 5_000);
      }

      // At t0 + 5_000, the 1-hour entry is still well within its 3_600_000ms window!
      const checkLong = checkRateLimit(
        "long-lived",
        { limit: 1, windowMs: 3_600_000 },
        t0 + 5_000,
      );
      expect(checkLong.allowed).toBe(false);
    });

    it("enforces MAX_STORE_KEYS = 5000 by evicting oldest keys when full", () => {
      const now = 2_000_000;
      for (let i = 0; i < 5005; i++) {
        checkRateLimit(`cap-key-${i}`, { limit: 1, windowMs: 60_000 }, now);
      }
      // cap-key-0 was evicted once 5000 active keys were exceeded, so it should be allowed again
      const evicted = checkRateLimit(
        "cap-key-0",
        { limit: 1, windowMs: 60_000 },
        now + 1,
      );
      expect(evicted.allowed).toBe(true);
    });

    it("prefers x-real-ip and takes the rightmost hop of x-forwarded-for", async () => {
      const savedTrust = process.env.TRUST_FORWARDED_HEADERS;
      process.env.TRUST_FORWARDED_HEADERS = "1";
      try {
        mock.module("next/headers", () => ({
          headers: async () =>
            new Headers({
              "x-real-ip": "198.51.100.42",
              "x-forwarded-for": "10.0.0.1, 203.0.113.5",
            }),
        }));
        expect(await getClientIp()).toBe("198.51.100.42");

        mock.module("next/headers", () => ({
          headers: async () =>
            new Headers({
              "x-forwarded-for": "spoofed.1.2.3.4, 203.0.113.99",
            }),
        }));
        expect(await getClientIp()).toBe("203.0.113.99");
      } finally {
        if (savedTrust === undefined) delete process.env.TRUST_FORWARDED_HEADERS;
        else process.env.TRUST_FORWARDED_HEADERS = savedTrust;
      }
    });
  });

  // =========================================================================
  // 6. P1-13: src/lib/pocketbase/session.ts getRequestOrigin
  // =========================================================================
  describe("6. P1-13: getRequestOrigin Multi-Hop & Loopback HTTP", () => {
    const savedAppUrl = process.env.APP_URL;
    const savedTrust = process.env.TRUST_FORWARDED_HEADERS;

    afterEach(() => {
      if (savedAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = savedAppUrl;
      if (savedTrust === undefined) delete process.env.TRUST_FORWARDED_HEADERS;
      else process.env.TRUST_FORWARDED_HEADERS = savedTrust;
    });

    it("splits multi-hop x-forwarded-host and x-forwarded-proto on comma", () => {
      delete process.env.APP_URL;
      process.env.TRUST_FORWARDED_HEADERS = "1";

      const origin = sessionModule.getRequestOrigin({
        headers: {
          get: (name: string) => {
            if (name === "x-forwarded-host") return "hepyeni.net, proxy.internal";
            if (name === "x-forwarded-proto") return "https, http";
            return null;
          },
        },
      });
      expect(origin).toBe("https://hepyeni.net");
    });

    it("uses http:// instead of https:// for untrusted loopback Host fallback", () => {
      delete process.env.APP_URL;
      delete process.env.TRUST_FORWARDED_HEADERS;

      const loOrigin = sessionModule.getRequestOrigin({
        headers: {
          get: (name: string) => (name === "host" ? "127.0.0.1:3000" : null),
        },
      });
      expect(loOrigin).toBe("http://127.0.0.1:3000");

      const localhostOrigin = sessionModule.getRequestOrigin({
        headers: {
          get: (name: string) => (name === "host" ? "localhost:3000" : null),
        },
      });
      expect(localhostOrigin).toBe("http://localhost:3000");
    });
  });

  // =========================================================================
  // 7. P2-7 & P2-16: Admin Guards & Filter Validation
  // =========================================================================
  describe("7. P2-7 & P2-16: requireAdmin Banned Check, buildIdListFilter & Admin Pages", () => {
    it("requireAdmin rejects banned admins", async () => {
      spyOn(superuserModule, "getSuperuserClient").mockResolvedValue({
        collection: () => ({
          getOne: async () => ({
            id: "usr_banned_admin",
            isAdmin: true,
            bannedAt: "2026-09-01T00:00:00.000Z",
          }),
        }),
      } as never);

      await expect(requireAdmin("usr_banned_admin")).rejects.toThrow(
        "Admin access required",
      );
    });

    it("buildIdListFilter rejects malformed IDs containing filter injection syntax", () => {
      expect(() =>
        buildIdListFilter("group", ['abc" || 1=1 || group = "']),
      ).toThrow();
      expect(() => buildIdListFilter("group; DROP", ["abc123"])).toThrow();
    });

    it("enforces requireAdmin across admin layout and pages", () => {
      const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf-8");
      expect(adminLayout).toContain('redirect("/groups")');

      for (const pagePath of [
        "src/app/admin/page.tsx",
        "src/app/admin/groups/page.tsx",
        "src/app/admin/groups/[groupId]/page.tsx",
        "src/app/admin/users/page.tsx",
      ]) {
        const content = readFileSync(pagePath, "utf-8");
        expect(content).toContain("requireAdmin(");
      }
    });
  });

  // =========================================================================
  // 8. P1-15, P3-2, P3-20: Superuser 401/403 Recovery & Migrations
  // =========================================================================
  describe("8. P1-15, P3-2, P3-20: Superuser Auth Recovery & Migrations", () => {
    it("clears superuser authStore when afterSend observes 401 or 403", () => {
      const pb = globalThis.__pbSuperuser;
      expect(pb).toBeDefined();
      if (!pb) return;

      pb.authStore.save("fake-token", { id: "su_1" } as never);
      expect(pb.authStore.token).toBe("fake-token");
      expect(typeof pb.afterSend).toBe("function");

      pb.afterSend?.({ status: 401 } as Response, {});
      expect(pb.authStore.token).toBe("");
    });

    it("verifies migration fixes in pb_migrations", () => {
      const m1 = readFileSync(
        "pb_migrations/1755281000_comment_replies_schema.js",
        "utf-8",
      );
      const removeIdxPos = m1.indexOf('comments.removeIndex("idx_comments_parent")');
      const removeFieldPos = m1.indexOf('comments.fields.removeByName("parentId")');
      expect(removeIdxPos).toBeGreaterThan(-1);
      expect(removeIdxPos).toBeLessThan(removeFieldPos);

      const m2 = readFileSync(
        "pb_migrations/1755288000_lock_users_collection.js",
        "utf-8",
      );
      expect(m2).toContain('collection.listRule = "id = @request.auth.id";');
      expect(m2).toContain('collection.viewRule = "id = @request.auth.id";');
      expect(m2).toContain('collection.deleteRule = "id = @request.auth.id";');

      const m3 = readFileSync(
        "pb_migrations/1755288100_user_media_progress_group_title_index.js",
        "utf-8",
      );
      expect(m3).toContain("collection.indexes.some");
    });
  });
});
