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

export function evaluateCircleAccess(
  group: GroupsResponse,
  membership?: GroupMembersResponse | null,
): CircleAccess {
  if (membership) {
    return {
      group,
      isOwner: membership.role === "owner",
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

  const isPublic = Boolean(group.isPublic);
  if (!isPublic) {
    return {
      group,
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

  const settings: GroupGuestSettings = {
    visibility: {
      backlog:
        group.guestSettings?.visibility?.backlog ??
        DEFAULT_GUEST_SETTINGS.visibility.backlog,
      finished:
        group.guestSettings?.visibility?.finished ??
        DEFAULT_GUEST_SETTINGS.visibility.finished,
      reviews:
        group.guestSettings?.visibility?.reviews ??
        DEFAULT_GUEST_SETTINGS.visibility.reviews,
      comments:
        group.guestSettings?.visibility?.comments ??
        DEFAULT_GUEST_SETTINGS.visibility.comments,
    },
    permissions: {
      canVote:
        group.guestSettings?.permissions?.canVote ??
        DEFAULT_GUEST_SETTINGS.permissions.canVote,
      canComment:
        group.guestSettings?.permissions?.canComment ??
        DEFAULT_GUEST_SETTINGS.permissions.canComment,
      canReview:
        group.guestSettings?.permissions?.canReview ??
        DEFAULT_GUEST_SETTINGS.permissions.canReview,
      canPropose:
        group.guestSettings?.permissions?.canPropose ??
        DEFAULT_GUEST_SETTINGS.permissions.canPropose,
    },
  };

  return {
    group,
    isOwner: false,
    isMember: false,
    isGuest: true,
    canViewBacklog: settings.visibility.backlog,
    canViewFinished: settings.visibility.finished,
    canViewReviews: settings.visibility.reviews,
    canViewComments: settings.visibility.comments,
    canVote: settings.permissions.canVote,
    canComment: settings.permissions.canComment,
    canReview: settings.permissions.canReview,
    canPropose: settings.permissions.canPropose,
  };
}

export async function resolveCircleAccess(
  groupId: string,
  userId?: string,
): Promise<CircleAccess> {
  const pb = await getSuperuserClient();
  let group: GroupsResponse;
  try {
    group = await pb.collection("groups").getOne<GroupsResponse>(groupId);
  } catch (err) {
    if (isNotFound(err)) throw new Error("Circle not found");
    throw err;
  }

  let membership: GroupMembersResponse | null = null;
  if (userId) {
    try {
      membership = await pb
        .collection("group_members")
        .getFirstListItem<GroupMembersResponse>(
          pb.filter("group = {:groupId} && user = {:userId}", {
            groupId,
            userId,
          }),
        );
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  return evaluateCircleAccess(group, membership);
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
