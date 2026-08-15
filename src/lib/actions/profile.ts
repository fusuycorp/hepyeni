"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { clearSessionCookie, getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";

export async function updateProfileName(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const pb = await getSuperuserClient();
  await pb.collection("users").update(session.id, { name });

  revalidatePath("/profile");
}

export async function deleteAccount() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  try {
    await pb.collection("users").delete(session.id);
  } catch (err) {
    // groups.createdBy and titles.addedBy point back at the user without
    // cascadeDelete — PocketBase rejects the delete with a 400 rather than
    // orphan those records, so a user who owns a group or has added titles
    // can't self-delete until that's resolved. Anything else (network
    // error, PocketBase down, stale session) is a different problem and
    // shouldn't be reported as if it were this one.
    if (err instanceof ClientResponseError && err.status === 400) {
      throw new Error(
        "You still own a group or have added titles others rely on — leave or delete those groups first.",
      );
    }
    throw err;
  }

  await clearSessionCookie();
  // Invoked imperatively from a client component (see ConfirmActionButton) —
  // redirect() here would be swallowed by that call site's own try/catch
  // instead of reaching Next's RedirectBoundary, so the caller navigates
  // itself once this resolves.
}
