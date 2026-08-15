"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";

export async function submitReview(
  titleId: string,
  groupId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number between 1 and 5");
  }
  const rawReview = String(formData.get("reviewText") ?? "").trim();
  const reviewText = rawReview ? rawReview.slice(0, 5000) : null;

  const pb = await getSuperuserClient();
  try {
    await pb.collection("reviews").create({
      title: titleId,
      user: session.id,
      rating,
      reviewText,
    });
  } catch (err) {
    if (!isValidationNotUnique(err)) throw err;

    const existing = await pb
      .collection("reviews")
      .getFirstListItem(
        pb.filter("title = {:titleId} && user = {:userId}", {
          titleId,
          userId: session.id,
        }),
      );
    await pb.collection("reviews").update(existing.id, { rating, reviewText });
  }

  revalidatePath(`/groups/${groupId}`);
}
