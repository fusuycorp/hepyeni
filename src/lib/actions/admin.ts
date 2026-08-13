"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  groupMembers,
  groups,
  reviews,
  sessions,
  titles,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

async function requireCallerAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requireAdmin(session.user.id);
  return session.user.id;
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const callerId = await requireCallerAdmin();
  if (userId === callerId) {
    throw new Error("You can't change your own admin status");
  }

  await db.update(users).set({ isAdmin }).where(eq(users.id, userId));

  revalidatePath("/admin/users");
}

export async function banUser(userId: string) {
  const callerId = await requireCallerAdmin();
  if (userId === callerId) throw new Error("You can't ban yourself");

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ bannedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });

  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  await requireCallerAdmin();

  await db.update(users).set({ bannedAt: null }).where(eq(users.id, userId));

  revalidatePath("/admin/users");
}

export async function adminDeleteGroup(groupId: string) {
  await requireCallerAdmin();

  await db.delete(groups).where(eq(groups.id, groupId));

  revalidatePath("/admin/groups");
}

export async function adminDeleteTitle(titleId: string, groupId: string) {
  await requireCallerAdmin();

  await db
    .delete(titles)
    .where(and(eq(titles.id, titleId), eq(titles.groupId, groupId)));

  revalidatePath(`/admin/groups/${groupId}`);
}

export async function adminDeleteReview(reviewId: string, groupId: string) {
  await requireCallerAdmin();

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    with: { title: true },
  });
  if (!review || review.title.groupId !== groupId) {
    throw new Error("Review not found in this group");
  }

  await db.delete(reviews).where(eq(reviews.id, reviewId));

  revalidatePath(`/admin/groups/${groupId}`);
}

export async function adminRemoveGroupMember(
  groupId: string,
  userId: string,
) {
  await requireCallerAdmin();

  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );

  revalidatePath(`/admin/groups/${groupId}`);
}
