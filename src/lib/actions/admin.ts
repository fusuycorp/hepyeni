"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  ReviewsResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

async function requireCallerAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireAdmin(session.id);
  return session.id;
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const callerId = await requireCallerAdmin();
  if (userId === callerId) {
    throw new Error("You can't change your own admin status");
  }

  const pb = await getSuperuserClient();
  await pb.collection("users").update(userId, { isAdmin });

  revalidatePath("/admin/users");
}

export async function banUser(userId: string) {
  const callerId = await requireCallerAdmin();
  if (userId === callerId) throw new Error("You can't ban yourself");

  const pb = await getSuperuserClient();
  // A single-field update — no session table to clean up, unlike today's
  // two-statement transaction. PocketBase's JWTs are otherwise stateless,
  // but getSession()'s authRefresh-based freshness check (see
  // src/lib/pocketbase/session.ts) means this still takes effect on the
  // banned user's very next request, the same latency NextAuth's
  // delete-all-sessions gave us.
  await pb
    .collection("users")
    .update(userId, { bannedAt: new Date().toISOString() });

  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  await requireCallerAdmin();

  const pb = await getSuperuserClient();
  await pb.collection("users").update(userId, { bannedAt: null });

  revalidatePath("/admin/users");
}

export async function adminDeleteGroup(groupId: string) {
  await requireCallerAdmin();

  const pb = await getSuperuserClient();
  // cascadeDelete:true on group_members.group and titles.group (and
  // transitively votes/reviews via titles.*) handles cleanup natively —
  // no explicit child-deletion helper needed, unlike a Document-DB-style
  // backend without native relation cascades.
  await pb.collection("groups").delete(groupId);

  revalidatePath("/admin/groups");
}

export async function adminDeleteTitle(titleId: string, groupId: string) {
  await requireCallerAdmin();

  const pb = await getSuperuserClient();
  let title: TitlesResponse;
  try {
    title = await pb.collection("titles").getOne<TitlesResponse>(titleId);
  } catch (err) {
    if (isNotFound(err)) throw new Error("Title not found in this group");
    throw err;
  }

  if (title.group !== groupId) {
    throw new Error("Title not found in this group");
  }

  await pb.collection("titles").delete(titleId);

  revalidatePath(`/admin/groups/${groupId}`);
}

export async function adminDeleteReview(reviewId: string, groupId: string) {
  await requireCallerAdmin();

  const pb = await getSuperuserClient();

  let review: ReviewsResponse<{ title?: TitlesResponse }>;
  try {
    review = await pb
      .collection("reviews")
      .getOne<ReviewsResponse<{ title?: TitlesResponse }>>(reviewId, {
        expand: "title",
      });
  } catch (err) {
    if (isNotFound(err)) throw new Error("Review not found in this group");
    throw err;
  }

  if (review.expand?.title?.group !== groupId) {
    throw new Error("Review not found in this group");
  }

  await pb.collection("reviews").delete(reviewId);

  revalidatePath(`/admin/groups/${groupId}`);
}

export async function adminRemoveGroupMember(
  groupId: string,
  userId: string,
) {
  await requireCallerAdmin();

  const pb = await getSuperuserClient();
  let member: { id: string };
  try {
    member = await pb
      .collection("group_members")
      .getFirstListItem(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("Member not found in this group");
    throw err;
  }

  await pb.collection("group_members").delete(member.id);

  revalidatePath(`/admin/groups/${groupId}`);
}
