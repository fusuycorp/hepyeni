import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { GroupsResponse } from "@/types/pocketbase-types";

/**
 * Join a group using an invite code.
 * Internal server mutation helper — NOT exported as a raw Server Action
 * to prevent unauthenticated client RPC spoofing of arbitrary userIds.
 */
export async function joinGroupByCode(
  userId: string,
  code: string,
): Promise<string | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const ip = await getClientIp();
  const rl = checkRateLimit(`join-invite:${userId || ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return null;

  const pb = await getSuperuserClient();
  let group: GroupsResponse;
  try {
    group = await pb
      .collection("groups")
      .getFirstListItem<GroupsResponse>(
        pb.filter("inviteCode = {:code}", { code: cleanCode }),
      );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  try {
    await pb.collection("group_members").create({
      group: group.id,
      user: userId,
      role: "member",
    });
  } catch (err) {
    if (!isValidationNotUnique(err)) throw err;
  }

  return group.id;
}

/**
 * Consumes the pending invite code cookie (if set during unauthenticated onboarding)
 * and joins the user to that group.
 */
export async function autoJoinPendingInvite(
  userId: string,
): Promise<string | null> {
  const { consumePendingInviteCookie } = await import("@/lib/pocketbase/session");
  const pendingCode = await consumePendingInviteCookie();
  if (!pendingCode) return null;
  return joinGroupByCode(userId, pendingCode);
}
