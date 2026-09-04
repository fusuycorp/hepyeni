"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { generateInviteCode } from "@/lib/invite-code";
import { requireMembership, requireOwner } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type {
  GroupGuestSettings,
  GroupMembersResponse,
  GroupsResponse,
} from "@/types/pocketbase-types";
import { joinGroupByCode } from "@/lib/invites";
import {
  getGroupByInviteCode as getGroupByInviteCodeQuery,
  type PublicGroupOverview,
} from "@/lib/queries/groups";

export type { PublicGroupOverview };

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

export async function getGroupByInviteCode(
  code: string,
): Promise<PublicGroupOverview | null> {
  return getGroupByInviteCodeQuery(code);
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
