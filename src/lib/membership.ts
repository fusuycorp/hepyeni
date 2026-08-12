import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, titles } from "@/db/schema";

export async function requireMembership(groupId: string, userId: string) {
  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
    ),
  });
  if (!membership) throw new Error("You're not a member of this group");
  return membership;
}

// Membership only proves the caller belongs to the `groupId` they passed in —
// it says nothing about whether `titleId` actually belongs to that group.
// Server actions are directly callable with arbitrary arguments, so every
// action that mutates a title (or a row keyed by titleId) by an
// attacker-suppliable groupId must also check this, or a member of any
// group can act on titles belonging to a group they were never invited to.
export async function requireTitleInGroup(titleId: string, groupId: string) {
  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.groupId, groupId)),
  });
  if (!title) throw new Error("Title not found in this group");
  return title;
}
