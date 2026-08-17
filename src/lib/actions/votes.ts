"use server";

import { revalidatePath } from "next/cache";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { voteRecordId } from "@/lib/pocketbase/vote-id";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type { VotesResponse } from "@/types/pocketbase-types";

export async function voteOnTitle(
  titleId: string,
  groupId: string,
  value: "up" | "down",
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  if (value !== "up" && value !== "down") {
    return { success: false, error: "Geçersiz oy değeri." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canVote) {
      return { success: false, error: "Bu çemberde oy kullanma yetkiniz bulunmuyor." };
    }
    await requireTitleInGroup(titleId, groupId);

    const pb = await getSuperuserClient();
    const id = await voteRecordId(titleId, session.id);

    try {
      await pb
        .collection("votes")
        .create<VotesResponse>({ id, title: titleId, user: session.id, value });
    } catch (err) {
      if (!isValidationNotUnique(err)) throw err;

      try {
        const existing = await pb.collection("votes").getOne<VotesResponse>(id);
        if (existing.value === value) {
          await pb.collection("votes").delete(id);
        } else {
          await pb.collection("votes").update(id, { value });
        }
      } catch (toggleErr) {
        if (isNotFound(toggleErr)) {
          return { success: true, data: undefined };
        }
        throw toggleErr;
      }
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "voteOnTitle", titleId, groupId, value });
    return { success: false, error: "Oy kaydedilirken bir hata oluştu.", traceId: diag.traceId };
  }
}
