"use server";

import { revalidatePath } from "next/cache";
import { ClientResponseError } from "pocketbase";
import { clearSessionCookie, getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

export async function updateProfileName(
  formData: FormData,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  if (!name) {
    return { success: false, error: "Name is required" };
  }

  try {
    const pb = await getSuperuserClient();
    await pb.collection("users").update(session.id, { name });

    revalidatePath("/profile");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "updateProfileName" });
    return { success: false, error: "Failed to update profile name", traceId: diag.traceId };
  }
}

export async function deleteAccount(): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  const pb = await getSuperuserClient();
  try {
    await pb.collection("users").delete(session.id);
    await clearSessionCookie();
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 400) {
      const diag = logDiagnostic(err, { action: "deleteAccount", reason: "owned_groups_or_titles" });
      return {
        success: false,
        error:
          "You still own a group or have added titles others rely on — leave or delete those groups first.",
        traceId: diag.traceId,
      };
    }
    const diag = logDiagnostic(err, { action: "deleteAccount" });
    return { success: false, error: "Failed to delete account", traceId: diag.traceId };
  }
}
