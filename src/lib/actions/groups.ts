"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { generateInviteCode } from "@/lib/invite-code";
import { requireMembership, requireOwner } from "@/lib/membership";
import type {
  GroupMembersResponse,
  GroupsResponse,
} from "@/types/pocketbase-types";

// createGroup/joinGroup/leaveGroup/deleteGroup are all invoked imperatively
// from client components (group-forms.tsx, confirm-action-button.tsx) inside
// a try/catch, not as plain <form action>s — a redirect() thrown from inside
// that awaited call rejects the promise with Next's internal redirect
// signal, which our own catch block would swallow before Next's
// RedirectBoundary ever sees it (confirmed against
// next/dist/client/components/router-reducer/reducers/server-action-reducer.js:
// "the action promise will be rejected with a redirect so that it's handled
// by RedirectBoundary"). So these return where to go instead of redirecting
// themselves, and the calling client component navigates via useRouter()
// once the awaited call actually resolves — the same pattern already used
// by addTitle/AddTitleForm in titles.ts.

export async function createGroup(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Group name is required");

  const pb = await getSuperuserClient();

  // inviteCode is unique; astronomically unlikely to collide (32^8
  // combinations) but retry a few times rather than surfacing a raw
  // validation error to the user on the rare chance it does.
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
    throw new Error("Couldn't generate a unique invite code, try again");
  }

  await pb.collection("group_members").create({
    group: group.id,
    user: session.id,
    role: "owner",
  });

  return group.id;
}

export async function joinGroupByCode(
  userId: string,
  code: string,
): Promise<string | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

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
    // Re-joining a group is a silent no-op, matching the unique (group,
    // user) index behavior relied on today.
    if (!isValidationNotUnique(err)) throw err;
  }

  return group.id;
}

export async function joinGroup(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");

  const code = String(formData.get("code") ?? "");
  const groupId = await joinGroupByCode(session.id, code);
  if (!groupId) throw new Error("Invalid invite code");

  return groupId;
}

export async function joinGroupByCodeAction(code: string): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");

  const groupId = await joinGroupByCode(session.id, code);
  if (!groupId) throw new Error("Invalid invite code");

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  return groupId;
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
      pb.collection("titles").getFullList({
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
    proposedCount: proposedTitles.length,
    consumedCount: consumedResult.totalItems,
    isMember: Boolean(userMembership),
    proposedTitles: proposedTitles.map((t) => ({
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

export async function setPendingInviteAction(code: string): Promise<void> {
  const { setPendingInviteCookie } = await import("@/lib/pocketbase/session");
  await setPendingInviteCookie(code);
}


export async function renameGroup(groupId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireOwner(groupId, session.id);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Group name is required");

  const pb = await getSuperuserClient();
  await pb.collection("groups").update(groupId, { name });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
}

export async function regenerateInviteCode(groupId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
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
}

export async function removeMember(groupId: string, memberId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const requester = await requireOwner(groupId, session.id);

  const pb = await getSuperuserClient();
  const target = await pb
    .collection("group_members")
    .getOne<GroupMembersResponse>(memberId);
  if (target.group !== groupId) throw new Error("Member not found in this group");
  if (target.id === requester.id) {
    throw new Error('Use "Leave group" to remove yourself');
  }

  await pb.collection("group_members").delete(memberId);

  revalidatePath(`/groups/${groupId}/settings`);
  revalidatePath(`/groups/${groupId}`);
}

export async function leaveGroup(groupId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
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
      throw new Error(
        "Remove the other members before you leave as an owner",
      );
    }
    // Sole remaining owner leaving: delete the entire group to avoid orphaned circles
    await pb.collection("groups").delete(groupId);
    return;
  }

  await pb.collection("group_members").delete(membership.id);
}

export async function deleteGroup(groupId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireOwner(groupId, session.id);

  const pb = await getSuperuserClient();
  // group_members, titles, votes, and reviews all cascade-delete from
  // groups (see pb_migrations) — one call tears down everything.
  await pb.collection("groups").delete(groupId);
}
