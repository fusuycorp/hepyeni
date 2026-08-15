import { isNotFound } from "@/lib/pocketbase/errors";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

export async function requireMembership(
  groupId: string,
  userId: string,
): Promise<GroupMembersResponse> {
  const pb = await getSuperuserClient();
  try {
    return await pb
      .collection("group_members")
      .getFirstListItem<GroupMembersResponse>(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("You're not a member of this group");
    throw err;
  }
}

// Membership only proves the caller belongs to the `groupId` they passed in —
// it says nothing about whether `titleId` actually belongs to that group.
// Server actions are directly callable with arbitrary arguments, so every
// action that mutates a title (or a row keyed by titleId) by an
// attacker-suppliable groupId must also check this, or a member of any
// group can act on titles belonging to a group they were never invited to.
export async function requireTitleInGroup(
  titleId: string,
  groupId: string,
): Promise<TitlesResponse> {
  const pb = await getSuperuserClient();
  try {
    return await pb
      .collection("titles")
      .getFirstListItem<TitlesResponse>(
        pb.filter("id = {:titleId} && group = {:groupId}", {
          titleId,
          groupId,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) throw new Error("Title not found in this group");
    throw err;
  }
}
