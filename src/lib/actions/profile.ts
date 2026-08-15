"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  } catch {
    // groups.createdBy and titles.addedBy point back at the user without
    // cascadeDelete — PocketBase rejects the delete rather than orphan
    // those records, so a user who owns a group or has added titles can't
    // self-delete until that's resolved.
    throw new Error(
      "You still own a group or have added titles others rely on — leave or delete those groups first.",
    );
  }

  await clearSessionCookie();
  redirect("/login");
}
