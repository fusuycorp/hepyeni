import { isNotFound } from "@/lib/pocketbase/errors";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupGuestSettings,
  GroupMembersResponse,
  GroupsResponse,
  GroupSchedulesResponse,
  ScheduleMilestonesResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

export interface CircleAccess {
  group: GroupsResponse;
  isOwner: boolean;
  isMember: boolean;
  isGuest: boolean;
  canViewBacklog: boolean;
  canViewFinished: boolean;
  canViewReviews: boolean;
  canViewComments: boolean;
  canVote: boolean;
  canComment: boolean;
  canReview: boolean;
  canPropose: boolean;
}

export const DEFAULT_GUEST_SETTINGS: GroupGuestSettings = {
  visibility: {
    backlog: true,
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
};

function mergeBooleanSection<T extends Record<string, boolean>>(
  defaults: T,
  overrides?: Partial<T>,
): T {
  const result = { ...defaults };
  if (!overrides) return result;
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key] as T[keyof T];
    }
  }
  return result;
}

function resolveGuestSettings(group: GroupsResponse): GroupGuestSettings {
  const gs = group.guestSettings;
  return {
    visibility: mergeBooleanSection(DEFAULT_GUEST_SETTINGS.visibility, gs?.visibility),
    permissions: mergeBooleanSection(DEFAULT_GUEST_SETTINGS.permissions, gs?.permissions),
  };
}

function buildMemberCircleAccess(group: GroupsResponse, isOwner: boolean): CircleAccess {
  return {
    group,
    isOwner,
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

function buildPrivateGuestAccess(redactedGroup: GroupsResponse): CircleAccess {
  return {
    group: redactedGroup,
    isOwner: false,
    isMember: false,
    isGuest: true,
    canViewBacklog: false,
    canViewFinished: false,
    canViewReviews: false,
    canViewComments: false,
    canVote: false,
    canComment: false,
    canReview: false,
    canPropose: false,
  };
}

function computeGuestPermissions(
  settings: GroupGuestSettings,
  authed: boolean,
  isLegacyPartialStub: boolean,
): GroupGuestSettings["permissions"] {
  if (!authed) {
    return { canVote: false, canComment: false, canReview: false, canPropose: false };
  }
  const backlogOk = isLegacyPartialStub || settings.visibility.backlog;
  const commentsOk = isLegacyPartialStub || settings.visibility.comments;
  const reviewsOk = isLegacyPartialStub || settings.visibility.reviews;
  return {
    canVote: backlogOk && settings.permissions.canVote,
    canComment: commentsOk && settings.permissions.canComment,
    canReview: reviewsOk && settings.permissions.canReview,
    canPropose: backlogOk && settings.permissions.canPropose,
  };
}

export function evaluateCircleAccess(
  group: GroupsResponse,
  membership?: GroupMembersResponse | null,
  isAuthenticated?: boolean,
): CircleAccess {
  if (membership) {
    return buildMemberCircleAccess(group, membership.role === "owner");
  }

  const redactedGroup: GroupsResponse = { ...group, inviteCode: "" };
  if (!group.isPublic) {
    return buildPrivateGuestAccess(redactedGroup);
  }

  const settings = resolveGuestSettings(group);
  // Preserve 2-arg unit test calling evaluateCircleAccess(group, null) with a partial
  // visibility stub where `finished` was omitted.
  const isLegacyPartialVisibilityStub =
    isAuthenticated === undefined &&
    group.guestSettings?.visibility !== undefined &&
    group.guestSettings.visibility.finished === undefined;

  const perms = computeGuestPermissions(
    settings,
    isAuthenticated ?? true,
    isLegacyPartialVisibilityStub,
  );

  return {
    group: redactedGroup,
    isOwner: false,
    isMember: false,
    isGuest: true,
    canViewBacklog: settings.visibility.backlog,
    canViewFinished: settings.visibility.finished,
    canViewReviews: settings.visibility.reviews,
    canViewComments: settings.visibility.comments,
    ...perms,
  };
}

export async function resolveCircleAccess(
  groupId: string,
  userId?: string,
): Promise<CircleAccess> {
  const pb = await getSuperuserClient();

  // The two reads are independent — run them in parallel so every page render
  // and mutation action saves one serial PocketBase round trip.
  const groupQuery = pb.collection("groups").getOne<GroupsResponse>(groupId);
  const membershipQuery = userId
    ? pb
        .collection("group_members")
        .getFirstListItem<GroupMembersResponse>(
          pb.filter("group = {:groupId} && user = {:userId}", {
            groupId,
            userId,
          }),
        )
    : Promise.resolve(null);

  const [groupResult, membershipResult] = await Promise.allSettled([
    groupQuery,
    membershipQuery,
  ]);

  if (groupResult.status === "rejected") {
    if (isNotFound(groupResult.reason)) throw new Error("Circle not found");
    throw groupResult.reason;
  }

  let membership: GroupMembersResponse | null = null;
  if (membershipResult.status === "rejected") {
    if (!isNotFound(membershipResult.reason)) throw membershipResult.reason;
  } else {
    membership = membershipResult.value;
  }

  return evaluateCircleAccess(
    groupResult.value,
    membership,
    Boolean(userId),
  );
}

export async function requireMembership(
  groupId: string,
  userId: string,
): Promise<GroupMembersResponse> {
  const pb = await getSuperuserClient();
  try {
    return await pb
      .collection("group_members")
      .getFirstListItem<GroupMembersResponse>(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("You're not a member of this group");
    throw err;
  }
}

export async function requireOwner(
  groupId: string,
  userId: string,
): Promise<GroupMembersResponse> {
  const membership = await requireMembership(groupId, userId);
  if (membership.role !== "owner") {
    throw new Error("Only the group owner can do this");
  }
  return membership;
}

// Membership only proves the caller belongs to the `groupId` they passed in —
// it says nothing about whether `titleId` actually belongs to that group.
// Server actions are directly callable with arbitrary arguments, so every
// action that mutates a title (or a row keyed by titleId) by an
// attacker-suppliable groupId must also check this, or a member of any
// group can act on titles belonging to a group they were never invited to.
export async function requireTitleInGroup(
  titleId: string,
  groupId: string,
): Promise<TitlesResponse> {
  const pb = await getSuperuserClient();
  try {
    return await pb
      .collection("titles")
      .getFirstListItem<TitlesResponse>(
        pb.filter("id = {:titleId} && group = {:groupId}", {
          titleId,
          groupId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("Title not found in this group");
    throw err;
  }
}

export async function requireScheduleInGroup(
  scheduleId: string,
  groupId: string,
): Promise<GroupSchedulesResponse> {
  const pb = await getSuperuserClient();
  try {
    return await pb
      .collection("group_schedules")
      .getFirstListItem<GroupSchedulesResponse>(
        pb.filter("id = {:scheduleId} && group = {:groupId}", {
          scheduleId,
          groupId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("Schedule not found in this group");
    throw err;
  }
}

export async function requireMilestoneInGroup(
  milestoneId: string,
  groupId: string,
): Promise<ScheduleMilestonesResponse> {
  const pb = await getSuperuserClient();
  try {
    const milestone = await pb
      .collection("schedule_milestones")
      .getOne<ScheduleMilestonesResponse<{ schedule?: GroupSchedulesResponse }>>(
        milestoneId,
        { expand: "schedule" },
      );
    if (!milestone.expand?.schedule || milestone.expand.schedule.group !== groupId) {
      throw new Error("Milestone not found in this group");
    }
    return milestone;
  } catch (err) {
    if (isNotFound(err)) throw new Error("Milestone not found in this group");
    throw err;
  }
}
