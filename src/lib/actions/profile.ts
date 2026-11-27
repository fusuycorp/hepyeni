"use server";

import { revalidatePath } from "next/cache";
import { ClientResponseError } from "pocketbase";
import { isNotFound } from "@/lib/pocketbase/errors";
import { clearSessionCookie, getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

import type {
  GroupMembersResponse,
  GroupsResponse,
  GroupSchedulesResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

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

async function transferOrDeleteOwnedGroup(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  group: GroupsResponse,
  userId: string,
): Promise<void> {
  const otherMembers = await pb
    .collection("group_members")
    .getFullList<GroupMembersResponse>({
      filter: pb.filter("group = {:groupId} && user != {:userId}", {
        groupId: group.id,
        userId,
      }),
      sort: "joinedAt",
    });

  if (otherMembers.length === 0) {
    await pb.collection("groups").delete(group.id);
    return;
  }

  const successor = otherMembers.find((m) => m.role === "owner") ?? otherMembers[0];
  if (successor.role !== "owner") {
    await pb.collection("group_members").update(successor.id, { role: "owner" });
  }
  await pb.collection("groups").update(group.id, { createdBy: successor.user });
}

async function reassignOrDeleteGroupRecords(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  collectionName: "titles" | "group_schedules",
  ownerField: "addedBy" | "createdBy",
  userId: string,
): Promise<void> {
  const records = await pb
    .collection(collectionName)
    .getFullList<TitlesResponse | GroupSchedulesResponse>({
      filter: pb.filter(`${ownerField} = {:userId}`, { userId }),
    });

  for (const rec of records) {
    const group = await pb
      .collection("groups")
      .getOne<GroupsResponse>(rec.group)
      .catch((err) => {
        if (isNotFound(err)) return null;
        throw err;
      });
    if (group?.createdBy && group.createdBy !== userId) {
      await pb.collection(collectionName).update(rec.id, { [ownerField]: group.createdBy });
    } else {
      await pb.collection(collectionName).delete(rec.id);
    }
  }
}

export async function deleteAccount(): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  try {
    const pb = await getSuperuserClient();
    // Clean up or reassign records with cascadeDelete: false referencing session.id
    const ownedGroups = await pb.collection("groups").getFullList<GroupsResponse>({
      filter: pb.filter("createdBy = {:userId}", { userId: session.id }),
    });

    for (const group of ownedGroups) {
      await transferOrDeleteOwnedGroup(pb, group, session.id);
    }

    await reassignOrDeleteGroupRecords(pb, "titles", "addedBy", session.id);
    await reassignOrDeleteGroupRecords(pb, "group_schedules", "createdBy", session.id);

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
