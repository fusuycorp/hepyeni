"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";

export async function submitReview(
  titleId: string,
  groupId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireMembership(groupId, session.user.id);
  await requireTitleInGroup(titleId, groupId);

  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number between 1 and 5");
  }
  const reviewText = String(formData.get("reviewText") ?? "").trim() || null;

  await db
    .insert(reviews)
    .values({ titleId, userId: session.user.id, rating, reviewText })
    .onConflictDoUpdate({
      target: [reviews.titleId, reviews.userId],
      set: { rating, reviewText },
    });

  revalidatePath(`/groups/${groupId}`);
}
