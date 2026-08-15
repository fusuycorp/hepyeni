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

export async function joinGroup(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) throw new Error("Invite code is required");

  const pb = await getSuperuserClient();

  let group: GroupsResponse;
  try {
    group = await pb
      .collection("groups")
      .getFirstListItem<GroupsResponse>(
        pb.filter("inviteCode = {:code}", { code }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("Invalid invite code");
    throw err;
  }

  try {
    await pb.collection("group_members").create({
      group: group.id,
      user: session.id,
      role: "member",
    });
  } catch (err) {
    // Re-joining a group is a silent no-op, matching the unique (group,
    // user) index behavior relied on today.
    if (!isValidationNotUnique(err)) throw err;
  }

  return group.id;
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
        "Remove the other members (or make one of them owner) before you leave",
      );
    }
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
