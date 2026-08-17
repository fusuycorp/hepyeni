"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

export async function submitReview(
  titleId: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canReview) {
      return { success: false, error: "Bu çemberde inceleme yazma yetkiniz bulunmuyor." };
    }
    await requireTitleInGroup(titleId, groupId);

    const rating = Number(formData.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { success: false, error: "Puan 1 ile 5 arasında tam sayı olmalıdır." };
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
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "submitReview", titleId, groupId });
    return { success: false, error: "İnceleme kaydedilirken bir hata oluştu.", traceId: diag.traceId };
  }
}
