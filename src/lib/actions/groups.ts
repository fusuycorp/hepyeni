"use server";

import { redirect } from "next/navigation";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { generateInviteCode } from "@/lib/invite-code";
import type { GroupsResponse } from "@/types/pocketbase-types";

export async function createGroup(formData: FormData) {
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

  redirect(`/groups/${group.id}`);
}

export async function joinGroup(formData: FormData) {
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

  redirect(`/groups/${group.id}`);
}
