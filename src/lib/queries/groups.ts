import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { redactProposedTitles } from "@/lib/moods";
import type { GroupMembersResponse, GroupsResponse } from "@/types/pocketbase-types";

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

async function findGroupByCleanInviteCode(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  cleanCode: string,
): Promise<GroupsResponse | null> {
  try {
    return await pb
      .collection("groups")
      .getFirstListItem<GroupsResponse>(
        pb.filter("inviteCode = {:code}", { code: cleanCode }),
      );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

function projectVisibleInviteProposals(
  items: Array<Record<string, unknown> & { id: string }>,
  group: GroupsResponse,
  userMembership: GroupMembersResponse | null,
  isAdmin?: boolean,
): PublicGroupOverview["proposedTitles"] {
  const canViewBacklog =
    Boolean(userMembership) ||
    group.guestSettings?.visibility?.backlog !== false;
  if (!canViewBacklog) return [];

  const isOwnerOrAdmin = userMembership?.role === "owner" || Boolean(isAdmin);
  return redactProposedTitles(
    items as Array<{
      id: string;
      title: string;
      creator?: string;
      mediaType: string;
      coverUrl?: string;
      createdAt: string;
      status?: string;
      addedBy?: string;
    }>,
    Boolean(group.isBlindPickEnabled),
    isOwnerOrAdmin,
  ).map((t) => ({
    id: t.id,
    title: t.title,
    creator: t.creator,
    mediaType: t.mediaType,
    coverUrl: t.coverUrl,
    createdAt: t.createdAt,
  }));
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
  const group = await findGroupByCleanInviteCode(pb, cleanCode);
  if (!group) return null;

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
            .getFirstListItem<GroupMembersResponse>(
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
    proposedTitles: projectVisibleInviteProposals(
      proposedTitles.items,
      group,
      userMembership,
      session?.isAdmin,
    ),
  };
}
