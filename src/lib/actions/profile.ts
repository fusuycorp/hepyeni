"use server";

import { revalidatePath } from "next/cache";
import { ClientResponseError } from "pocketbase";
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

export async function deleteAccount(): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first" };
  }

  const pb = await getSuperuserClient();
  try {
    // Clean up or reassign records with cascadeDelete: false referencing session.id
    const ownedGroups = await pb.collection("groups").getFullList<GroupsResponse>({
      filter: pb.filter("createdBy = {:userId}", { userId: session.id }),
    });

    for (const group of ownedGroups) {
      const otherMembers = await pb
        .collection("group_members")
        .getFullList<GroupMembersResponse>({
          filter: pb.filter("group = {:groupId} && user != {:userId}", {
            groupId: group.id,
            userId: session.id,
          }),
          sort: "joinedAt",
        });

      if (otherMembers.length > 0) {
        const successor =
          otherMembers.find((m) => m.role === "owner") ?? otherMembers[0];
        if (successor.role !== "owner") {
          await pb
            .collection("group_members")
            .update(successor.id, { role: "owner" });
        }
        await pb
          .collection("groups")
          .update(group.id, { createdBy: successor.user });
      } else {
        await pb.collection("groups").delete(group.id);
      }
    }

    const addedTitles = await pb.collection("titles").getFullList<TitlesResponse>({
      filter: pb.filter("addedBy = {:userId}", { userId: session.id }),
    });
    for (const title of addedTitles) {
      const group = await pb
        .collection("groups")
        .getOne<GroupsResponse>(title.group)
        .catch(() => null);
      if (group && group.createdBy && group.createdBy !== session.id) {
        await pb
          .collection("titles")
          .update(title.id, { addedBy: group.createdBy });
      } else {
        await pb.collection("titles").delete(title.id);
      }
    }

    const createdSchedules = await pb
      .collection("group_schedules")
      .getFullList<GroupSchedulesResponse>({
        filter: pb.filter("createdBy = {:userId}", { userId: session.id }),
      });
    for (const schedule of createdSchedules) {
      const group = await pb
        .collection("groups")
        .getOne<GroupsResponse>(schedule.group)
        .catch(() => null);
      if (group && group.createdBy && group.createdBy !== session.id) {
        await pb
          .collection("group_schedules")
          .update(schedule.id, { createdBy: group.createdBy });
      } else {
        await pb.collection("group_schedules").delete(schedule.id);
      }
    }

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
