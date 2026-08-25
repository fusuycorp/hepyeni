"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

// ponytail: action-layer error strings <- hardcoded English in action layer -> map stable error codes through useTranslations on client

export async function submitReview(
  titleId: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    // M-4: independent reads — access and title-in-group in parallel.
    const [access] = await Promise.all([
      resolveCircleAccess(groupId, session.id),
      requireTitleInGroup(titleId, groupId),
    ]);
    if (!access.canReview) {
      return { success: false, error: "You do not have permission to review in this circle." };
    }

    const rating = Number(formData.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { success: false, error: "Rating must be an integer between 1 and 5." };
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
      // H1-defensive: an empty/whitespace incoming reviewText means the client
      // lost its prefill (cluster-1 P1 strip regressed this). Never null out an
      // existing review body on a rating-only save — keep the stored body.
      const hasExistingBody = Boolean(existing.reviewText?.trim());
      const finalReviewText = reviewText ?? (hasExistingBody ? existing.reviewText : null);
      await pb.collection("reviews").update(existing.id, { rating, reviewText: finalReviewText });
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "submitReview", titleId, groupId });
    return { success: false, error: "Failed to save review.", traceId: diag.traceId };
  }
}
