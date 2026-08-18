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

// ponytail: action-layer error strings are hardcoded English (unified from a
// TR/EN mix). Ceiling: actions should return stable error codes mapped to
// client-side translations (useTranslations) for full TR/EN parity; until then
// EN keeps every locale's toasts readable and consistent.

export async function voteOnTitle(
  titleId: string,
  groupId: string,
  value: "up" | "down",
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  if (value !== "up" && value !== "down") {
    return { success: false, error: "Invalid vote value." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canVote) {
      return { success: false, error: "You do not have permission to vote in this circle." };
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
    return { success: false, error: "Failed to record vote.", traceId: diag.traceId };
  }
}
