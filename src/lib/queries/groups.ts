import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { GroupsResponse } from "@/types/pocketbase-types";

export type PublicGroupOverview = {
  group: GroupsResponse;
  memberCount: number;
  proposedCount: number;
  consumedCount: number;
  isMember?: boolean;
  proposedTitles: Array<{
    id: string;
    title: string;
    creator?: string;
    mediaType: string;
    coverUrl?: string;
    createdAt: string;
  }>;
};

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

export async function autoJoinPendingInvite(
  userId: string,
): Promise<string | null> {
  const { consumePendingInviteCookie } = await import("@/lib/pocketbase/session");
  const pendingCode = await consumePendingInviteCookie();
  if (!pendingCode) return null;
  return joinGroupByCode(userId, pendingCode);
}

export async function getGroupByInviteCode(
  code: string,
): Promise<PublicGroupOverview | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  const ip = await getClientIp();
  const rl = checkRateLimit(`preview-invite:${ip}`, { limit: 60, windowMs: 60_000 });
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

  const session = await getSession();

  const [membersResult, proposedTitles, consumedResult, userMembership] =
    await Promise.all([
      pb.collection("group_members").getList(1, 1, {
        filter: pb.filter("group = {:groupId}", { groupId: group.id }),
      }),
      // F-5: this runs on the public /invite/[code] page — cap the preview
      // list so a large backlog can't make the page arbitrarily heavy for
      // any caller holding a valid code. Count stays true via totalItems.
      pb.collection("titles").getList(1, 20, {
        filter: pb.filter("group = {:groupId} && status = 'proposed'", {
          groupId: group.id,
        }),
        fields: "id,title,creator,mediaType,coverUrl,createdAt",
        sort: "-createdAt",
      }),
      pb.collection("titles").getList(1, 1, {
        filter: pb.filter("group = {:groupId} && status = 'consumed'", {
          groupId: group.id,
        }),
      }),
      session
        ? pb
            .collection("group_members")
            .getFirstListItem(
              pb.filter("group = {:groupId} && user = {:userId}", {
                groupId: group.id,
                userId: session.id,
              }),
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

  return {
    group,
    memberCount: membersResult.totalItems,
    proposedCount: proposedTitles.totalItems,
    consumedCount: consumedResult.totalItems,
    isMember: Boolean(userMembership),
    proposedTitles: proposedTitles.items.map((t) => ({
      id: t.id,
      title: t.title,
      creator: t.creator,
      mediaType: t.mediaType,
      coverUrl: t.coverUrl,
      createdAt: t.createdAt,
    })),
  };
}
