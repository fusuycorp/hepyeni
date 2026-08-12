"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { generateInviteCode } from "@/lib/invite-code";

export async function createGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Group name is required");

  // inviteCode is unique; astronomically unlikely to collide (32^8
  // combinations) but retry a few times rather than surfacing a raw DB
  // constraint error to the user on the rare chance it does.
  let group;
  for (let attempt = 0; !group && attempt < 5; attempt++) {
    [group] = await db
      .insert(groups)
      .values({
        name,
        inviteCode: generateInviteCode(),
        createdBy: session.user.id,
      })
      .onConflictDoNothing({ target: groups.inviteCode })
      .returning();
  }
  if (!group) throw new Error("Couldn't generate a unique invite code, try again");

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    role: "owner",
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) throw new Error("Invite code is required");

  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, code),
  });
  if (!group) throw new Error("Invalid invite code");

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId: session.user.id, role: "member" })
    .onConflictDoNothing();

  redirect(`/groups/${group.id}`);
}
