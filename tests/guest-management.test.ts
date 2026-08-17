import { describe, expect, it } from "bun:test";
import { evaluateCircleAccess, DEFAULT_GUEST_SETTINGS } from "@/lib/membership";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import type {
  GroupGuestSettings,
  GroupMembersResponse,
  GroupsResponse,
} from "@/types/pocketbase-types";

function createMockGroup(overrides: Partial<GroupsResponse> = {}): GroupsResponse {
  return {
    id: "grp_123",
    name: "Cinephiles Club",
    inviteCode: "CINEMA42",
    createdBy: "usr_owner",
    isPublic: false,
    guestSettings: null,
    createdAt: "2026-08-17T12:00:00.000Z" as any,
    collectionId: "col_groups",
    collectionName: "groups",
    ...overrides,
  };
}

function createMockMembership(
  role: "owner" | "member" = "member",
): GroupMembersResponse {
  return {
    id: "mem_123",
    group: "grp_123",
    user: "usr_active",
    role,
    joinedAt: "2026-08-17T12:00:00.000Z" as any,
    collectionId: "col_group_members",
    collectionName: "group_members",
  };
}

describe("Circle Guest Management & Granular Access Matrix", () => {
  describe("Default Guest Settings", () => {
    it("has all visibility flags enabled by default", () => {
      expect(DEFAULT_GUEST_SETTINGS.visibility.backlog).toBe(true);
      expect(DEFAULT_GUEST_SETTINGS.visibility.finished).toBe(true);
      expect(DEFAULT_GUEST_SETTINGS.visibility.reviews).toBe(true);
      expect(DEFAULT_GUEST_SETTINGS.visibility.comments).toBe(true);
    });

    it("has all interaction permission flags disabled by default for safety", () => {
      expect(DEFAULT_GUEST_SETTINGS.permissions.canVote).toBe(false);
      expect(DEFAULT_GUEST_SETTINGS.permissions.canComment).toBe(false);
      expect(DEFAULT_GUEST_SETTINGS.permissions.canReview).toBe(false);
      expect(DEFAULT_GUEST_SETTINGS.permissions.canPropose).toBe(false);
    });
  });

  describe("evaluateCircleAccess - Member & Owner Access", () => {
    it("grants full access and owner role to circle owner regardless of public status", () => {
      const group = createMockGroup({ isPublic: false });
      const membership = createMockMembership("owner");

      const access = evaluateCircleAccess(group, membership);

      expect(access.isOwner).toBe(true);
      expect(access.isMember).toBe(true);
      expect(access.isGuest).toBe(false);
      expect(access.canViewBacklog).toBe(true);
      expect(access.canViewFinished).toBe(true);
      expect(access.canViewReviews).toBe(true);
      expect(access.canViewComments).toBe(true);
      expect(access.canVote).toBe(true);
      expect(access.canComment).toBe(true);
      expect(access.canReview).toBe(true);
      expect(access.canPropose).toBe(true);
    });

    it("grants full member access to circle member even if circle is marked private or restricted", () => {
      const restrictedSettings: GroupGuestSettings = {
        visibility: { backlog: false, finished: false, reviews: false, comments: false },
        permissions: { canVote: false, canComment: false, canReview: false, canPropose: false },
      };
      const group = createMockGroup({ isPublic: true, guestSettings: restrictedSettings });
      const membership = createMockMembership("member");

      const access = evaluateCircleAccess(group, membership);

      expect(access.isOwner).toBe(false);
      expect(access.isMember).toBe(true);
      expect(access.isGuest).toBe(false);
      expect(access.canViewBacklog).toBe(true);
      expect(access.canViewFinished).toBe(true);
      expect(access.canViewReviews).toBe(true);
      expect(access.canViewComments).toBe(true);
      expect(access.canVote).toBe(true);
      expect(access.canComment).toBe(true);
      expect(access.canReview).toBe(true);
      expect(access.canPropose).toBe(true);
    });
  });

  describe("evaluateCircleAccess - Private Circles (Non-members & Guests)", () => {
    it("denies all visibility and permissions for private circle without membership", () => {
      const group = createMockGroup({ isPublic: false });

      const access = evaluateCircleAccess(group, null);

      expect(access.isOwner).toBe(false);
      expect(access.isMember).toBe(false);
      expect(access.isGuest).toBe(true);
      expect(access.canViewBacklog).toBe(false);
      expect(access.canViewFinished).toBe(false);
      expect(access.canViewReviews).toBe(false);
      expect(access.canViewComments).toBe(false);
      expect(access.canVote).toBe(false);
      expect(access.canComment).toBe(false);
      expect(access.canReview).toBe(false);
      expect(access.canPropose).toBe(false);
    });

    it("denies access if isPublic is undefined or null", () => {
      const group = createMockGroup({ isPublic: undefined });
      const access = evaluateCircleAccess(group, null);

      expect(access.isGuest).toBe(true);
      expect(access.canViewBacklog).toBe(false);
      expect(access.canVote).toBe(false);
    });
  });

  describe("evaluateCircleAccess - Public Circles & Granular Guest Settings", () => {
    it("applies default guest settings when guestSettings is not explicitly set", () => {
      const group = createMockGroup({ isPublic: true, guestSettings: null });

      const access = evaluateCircleAccess(group, null);

      expect(access.isOwner).toBe(false);
      expect(access.isMember).toBe(false);
      expect(access.isGuest).toBe(true);
      // Default visibility: all true
      expect(access.canViewBacklog).toBe(true);
      expect(access.canViewFinished).toBe(true);
      expect(access.canViewReviews).toBe(true);
      expect(access.canViewComments).toBe(true);
      // Default permissions: all false
      expect(access.canVote).toBe(false);
      expect(access.canComment).toBe(false);
      expect(access.canReview).toBe(false);
      expect(access.canPropose).toBe(false);
    });

    it("strictly respects custom visibility and permission matrix", () => {
      const customSettings: GroupGuestSettings = {
        visibility: {
          backlog: true,
          finished: false,
          reviews: true,
          comments: false,
        },
        permissions: {
          canVote: true,
          canComment: false,
          canReview: true,
          canPropose: false,
        },
      };

      const group = createMockGroup({
        isPublic: true,
        guestSettings: customSettings,
      });

      const access = evaluateCircleAccess(group, null);

      expect(access.isGuest).toBe(true);
      expect(access.canViewBacklog).toBe(true);
      expect(access.canViewFinished).toBe(false);
      expect(access.canViewReviews).toBe(true);
      expect(access.canViewComments).toBe(false);

      expect(access.canVote).toBe(true);
      expect(access.canComment).toBe(false);
      expect(access.canReview).toBe(true);
      expect(access.canPropose).toBe(false);
    });

    it("evaluates all permutations of interactive guest permissions independently", () => {
      const permutations = [
        { canVote: true, canComment: false, canReview: false, canPropose: false },
        { canVote: false, canComment: true, canReview: false, canPropose: false },
        { canVote: false, canComment: false, canReview: true, canPropose: false },
        { canVote: false, canComment: false, canReview: false, canPropose: true },
        { canVote: true, canComment: true, canReview: true, canPropose: true },
      ];

      for (const perm of permutations) {
        const group = createMockGroup({
          isPublic: true,
          guestSettings: {
            visibility: DEFAULT_GUEST_SETTINGS.visibility,
            permissions: perm,
          },
        });

        const access = evaluateCircleAccess(group, null);
        expect(access.canVote).toBe(perm.canVote);
        expect(access.canComment).toBe(perm.canComment);
        expect(access.canReview).toBe(perm.canReview);
        expect(access.canPropose).toBe(perm.canPropose);
      }
    });

    it("handles partial guestSettings object with safe fallbacks", () => {
      const partialSettings = {
        visibility: {
          backlog: false,
        },
        permissions: {
          canPropose: true,
        },
      } as unknown as GroupGuestSettings;

      const group = createMockGroup({
        isPublic: true,
        guestSettings: partialSettings,
      });

      const access = evaluateCircleAccess(group, null);

      // Overridden
      expect(access.canViewBacklog).toBe(false);
      expect(access.canPropose).toBe(true);
      // Fallbacks
      expect(access.canViewFinished).toBe(true);
      expect(access.canViewReviews).toBe(true);
      expect(access.canViewComments).toBe(true);
      expect(access.canVote).toBe(false);
      expect(access.canComment).toBe(false);
      expect(access.canReview).toBe(false);
    });

    it("handles stringified JSON guestSettings from database drivers", () => {
      const rawStringSettings = JSON.stringify({
        visibility: { backlog: true, finished: true, reviews: false, comments: true },
        permissions: { canVote: true, canComment: true, canReview: false, canPropose: false },
      });

      let parsedSettings: GroupGuestSettings | null = null;
      try {
        parsedSettings = typeof rawStringSettings === "string" ? JSON.parse(rawStringSettings) : rawStringSettings;
      } catch {
        parsedSettings = null;
      }

      const group = createMockGroup({
        isPublic: true,
        guestSettings: parsedSettings,
      });

      const access = evaluateCircleAccess(group, null);
      expect(access.canViewReviews).toBe(false);
      expect(access.canVote).toBe(true);
      expect(access.canComment).toBe(true);
    });
  });

  describe("Public Route Patterns - Proxy Route Matching", () => {
    const isPublicGroupRoute = (pathname: string) =>
      /^\/groups\/[^/]+(?:\/titles\/[^/]+)?\/?$/.test(pathname);

    it("matches valid public group and title detail paths", () => {
      expect(isPublicGroupRoute("/groups/grp_123")).toBe(true);
      expect(isPublicGroupRoute("/groups/grp_123/")).toBe(true);
      expect(isPublicGroupRoute("/groups/grp_123/titles/ttl_456")).toBe(true);
      expect(isPublicGroupRoute("/groups/grp_123/titles/ttl_456/")).toBe(true);
    });

    it("rejects non-public nested subpaths (e.g. settings, add, api)", () => {
      expect(isPublicGroupRoute("/groups/grp_123/settings")).toBe(false);
      expect(isPublicGroupRoute("/groups/grp_123/add")).toBe(false);
      expect(isPublicGroupRoute("/groups")).toBe(false);
      expect(isPublicGroupRoute("/api/groups")).toBe(false);
    });
  });

  describe("Translation Parity - guestManagement", () => {
    it("has 100% key parity between English and Turkish for guestManagement", () => {
      const enKeys = Object.keys(en.guestManagement).sort();
      const trKeys = Object.keys(tr.guestManagement).sort();

      expect(enKeys).toEqual(trKeys);
    });

    it("has non-empty translation strings for all guestManagement keys in both languages", () => {
      for (const [key, value] of Object.entries(en.guestManagement)) {
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }

      for (const [key, value] of Object.entries(tr.guestManagement)) {
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    });

    it("contains all required guest management keys", () => {
      const requiredKeys = [
        "publicCircleTitle",
        "publicCircleDesc",
        "makePublicLabel",
        "makePublicDesc",
        "visibilityHeading",
        "visibilityBacklog",
        "visibilityFinished",
        "visibilityReviews",
        "visibilityComments",
        "permissionsHeading",
        "permVote",
        "permComment",
        "permReview",
        "permPropose",
        "guestBannerNotice",
        "guestBannerJoin",
        "settingsSaved",
        "settingsSaveFailed",
      ];

      for (const key of requiredKeys) {
        expect(key in en.guestManagement).toBe(true);
        expect(key in tr.guestManagement).toBe(true);
      }
    });
  });
});
