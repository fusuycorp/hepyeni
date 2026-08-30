"use server";

import { revalidatePath } from "next/cache";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { generateInviteCode } from "@/lib/invite-code";
import { requireMembership, requireOwner } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";
import type {
  GroupGuestSettings,
  GroupMembersResponse,
  GroupsResponse,
} from "@/types/pocketbase-types";

export async function createGroup(formData: FormData): Promise<ActionResult<{ groupId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName.slice(0, 100);
  if (!name) {
    return { success: false, error: "Group name is required" };
  }

  const pb = await getSuperuserClient();

  try {
    let group: GroupsResponse | undefined;
    for (let attempt = 0; !group && attempt < 5; attempt++) {
      try {
        group = await pb.collection("groups").create<GroupsResponse>({
          name,
          inviteCode: generateInviteCode(),
          createdBy: session.id,
        });
      } catch (err) {
        if (!isValidationNotUnique(err, "inviteCode")) throw err;
      }
    }
    if (!group) {
      return { success: false, error: "Couldn't generate a unique invite code, try again" };
    }

    await pb.collection("group_members").create({
      group: group.id,
      user: session.id,
      role: "owner",
    });

    revalidatePath("/groups");
    return { success: true, data: { groupId: group.id } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "createGroup", name });
    return { success: false, error: "Failed to create group", traceId: diag.traceId };
  }
}

export async function joinGroupByCode(
  userId: string,
  code: string,
): Promise<string | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const ip = await getClientIp();
  const rl = checkRateLimit(`join-invite:${userId || ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return null;

  const pb = await getSuperuserClient();
  let group: GroupsResponse;
  try {
    group = await pb
      .collection("groups")
      .getFirstListItem<GroupsResponse>(
        pb.filter("inviteCode = {:code}", { code: cleanCode }),
      );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  try {
    await pb.collection("group_members").create({
      group: group.id,
      user: userId,
      role: "member",
    });
  } catch (err) {
    if (!isValidationNotUnique(err)) throw err;
  }

  return group.id;
}

export async function joinGroup(formData: FormData): Promise<ActionResult<{ groupId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { success: false, error: "Invalid invite code" };
  }

  try {
    const groupId = await joinGroupByCode(session.id, code);
    if (!groupId) {
      return { success: false, error: "Invalid invite code" };
    }
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { groupId } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "joinGroup", code });
    return { success: false, error: "Failed to join circle", traceId: diag.traceId };
  }
}

export async function joinGroupByCodeAction(code: string): Promise<ActionResult<{ groupId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    const groupId = await joinGroupByCode(session.id, code);
    if (!groupId) {
      return { success: false, error: "Invalid invite code" };
    }

    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { groupId } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "joinGroupByCodeAction", code });
    return { success: false, error: "Failed to join circle", traceId: diag.traceId };
  }
}

export type PublicGroupOverview = {
  group: GroupsResponse;
  memberCount: number;
  proposedCount: number;
  consumedCount: number;
  isMember?: boolean;
  proposedTitles: Array<{
    id: string;
    title: string;
    creator?: string;
    mediaType: string;
    coverUrl?: string;
    createdAt: string;
  }>;
};

export async function getGroupByInviteCode(
  code: string,
): Promise<PublicGroupOverview | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const ip = await getClientIp();
  const rl = checkRateLimit(`preview-invite:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return null;

  const pb = await getSuperuserClient();
  let group: GroupsResponse;
  try {
    group = await pb
      .collection("groups")
      .getFirstListItem<GroupsResponse>(
        pb.filter("inviteCode = {:code}", { code: cleanCode }),
      );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  const session = await getSession();

  const [membersResult, proposedTitles, consumedResult, userMembership] =
    await Promise.all([
      pb.collection("group_members").getList(1, 1, {
        filter: pb.filter("group = {:groupId}", { groupId: group.id }),
      }),
      // F-5: this runs on the public /invite/[code] page — cap the preview
      // list so a large backlog can't make the page arbitrarily heavy for
      // any caller holding a valid code. Count stays true via totalItems.
      pb.collection("titles").getList(1, 20, {
        filter: pb.filter("group = {:groupId} && status = 'proposed'", {
          groupId: group.id,
        }),
        fields: "id,title,creator,mediaType,coverUrl,createdAt",
        sort: "-createdAt",
      }),
      pb.collection("titles").getList(1, 1, {
        filter: pb.filter("group = {:groupId} && status = 'consumed'", {
          groupId: group.id,
        }),
      }),
      session
        ? pb
            .collection("group_members")
            .getFirstListItem(
              pb.filter("group = {:groupId} && user = {:userId}", {
                groupId: group.id,
                userId: session.id,
              }),
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

  return {
    group,
    memberCount: membersResult.totalItems,
    proposedCount: proposedTitles.totalItems,
    consumedCount: consumedResult.totalItems,
    isMember: Boolean(userMembership),
    proposedTitles: proposedTitles.items.map((t) => ({
      id: t.id,
      title: t.title,
      creator: t.creator,
      mediaType: t.mediaType,
      coverUrl: t.coverUrl,
      createdAt: t.createdAt,
    })),
  };
}

export async function autoJoinPendingInvite(
  userId: string,
): Promise<string | null> {
  const { consumePendingInviteCookie } = await import("@/lib/pocketbase/session");
  const pendingCode = await consumePendingInviteCookie();
  if (!pendingCode) return null;
  return joinGroupByCode(userId, pendingCode);
}

export async function setPendingInviteAction(code: string): Promise<ActionResult<void>> {
  try {
    const { setPendingInviteCookie } = await import("@/lib/pocketbase/session");
    await setPendingInviteCookie(code);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "setPendingInviteAction", code });
    return { success: false, error: "Failed to record pending invite", traceId: diag.traceId };
  }
}

export async function renameGroup(
  groupId: string,
  formData: FormData,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    await requireOwner(groupId, session.id);

    const rawName = String(formData.get("name") ?? "").trim();
    const name = rawName.slice(0, 100);
    if (!name) {
      return { success: false, error: "Group name is required" };
    }

    const pb = await getSuperuserClient();
    await pb.collection("groups").update(groupId, { name });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settings`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "renameGroup", groupId });
    return { success: false, error: "Failed to rename group", traceId: diag.traceId };
  }
}

export async function regenerateInviteCode(
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    await requireOwner(groupId, session.id);

    const pb = await getSuperuserClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await pb
          .collection("groups")
          .update(groupId, { inviteCode: generateInviteCode() });
        break;
      } catch (err) {
        if (attempt === 4 || !isValidationNotUnique(err, "inviteCode")) {
          throw err;
        }
      }
    }

    revalidatePath(`/groups/${groupId}/settings`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "regenerateInviteCode", groupId });
    return { success: false, error: "Failed to regenerate invite code", traceId: diag.traceId };
  }
}

export async function removeMember(
  groupId: string,
  memberId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    const requester = await requireOwner(groupId, session.id);

    const pb = await getSuperuserClient();
    const target = await pb
      .collection("group_members")
      .getOne<GroupMembersResponse>(memberId);
    if (target.group !== groupId) {
      return { success: false, error: "Member not found in this group" };
    }
    if (target.id === requester.id) {
      return { success: false, error: 'Use "Leave group" to remove yourself' };
    }

    await pb.collection("group_members").delete(memberId);

    revalidatePath(`/groups/${groupId}/settings`);
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "removeMember", groupId, memberId });
    return { success: false, error: "Failed to remove member", traceId: diag.traceId };
  }
}

export async function leaveGroup(groupId: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    const membership = await requireMembership(groupId, session.id);

    const pb = await getSuperuserClient();

    if (membership.role === "owner") {
      const others = await pb.collection("group_members").getList(1, 1, {
        filter: pb.filter("group = {:groupId} && id != {:id}", {
          groupId,
          id: membership.id,
        }),
      });
      if (others.totalItems > 0) {
        return {
          success: false,
          error: "Remove the other members before you leave as an owner",
        };
      }
      await pb.collection("groups").delete(groupId);
      revalidatePath("/groups");
      return { success: true, data: undefined };
    }

    await pb.collection("group_members").delete(membership.id);
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "leaveGroup", groupId });
    return { success: false, error: "Failed to leave group", traceId: diag.traceId };
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    await requireOwner(groupId, session.id);

    const pb = await getSuperuserClient();
    await pb.collection("groups").delete(groupId);

    revalidatePath("/groups");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteGroup", groupId });
    return { success: false, error: "Failed to delete group", traceId: diag.traceId };
  }
}

export async function updateGroupGuestSettings(
  groupId: string,
  settings: GroupGuestSettings & { isPublic: boolean },
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    await requireOwner(groupId, session.id);

    const pb = await getSuperuserClient();
    await pb.collection("groups").update(groupId, {
      isPublic: Boolean(settings.isPublic),
      guestSettings: {
        visibility: {
          backlog: Boolean(settings.visibility?.backlog),
          finished: Boolean(settings.visibility?.finished),
          reviews: Boolean(settings.visibility?.reviews),
          comments: Boolean(settings.visibility?.comments),
        },
        permissions: {
          canVote: Boolean(settings.permissions?.canVote),
          canComment: Boolean(settings.permissions?.canComment),
          canReview: Boolean(settings.permissions?.canReview),
          canPropose: Boolean(settings.permissions?.canPropose),
        },
      },
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settings`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "updateGroupGuestSettings", groupId });
    return { success: false, error: "Failed to update guest settings", traceId: diag.traceId };
  }
}

export async function toggleBlindPickMode(
  groupId: string,
  enabled: boolean,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    await requireOwner(groupId, session.id);

    const pb = await getSuperuserClient();
    await pb.collection("groups").update(groupId, {
      isBlindPickEnabled: Boolean(enabled),
    });

    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settings`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "toggleBlindPickMode", groupId, enabled });
    return { success: false, error: "Failed to toggle blind pick mode", traceId: diag.traceId };
  }
}
