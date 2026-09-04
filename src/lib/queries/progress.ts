import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  resolveCircleAccess,
  type CircleAccess,
} from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";
import type {
  GroupMembersResponse,
  TitlesResponse,
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UsersResponse,
} from "@/types/pocketbase-types";

export interface TitleMemberProgressItem {
  user: PublicUser;
  progress: UserMediaProgressResponse;
  percentage?: number;
}

export async function getPersonalShelf(
  statusFilter?: UserMediaProgressStatusOptions,
  session?: Session | null,
): Promise<UserMediaProgressResponse[]> {
  const resolvedSession = session || (await getSession());
  if (!resolvedSession) return [];

  try {
    const pb = await getSuperuserClient();
    let filter = pb.filter("user = {:userId}", { userId: resolvedSession.id });
    if (statusFilter) {
      filter = pb.filter("user = {:userId} && status = {:status}", {
        userId: resolvedSession.id,
        status: statusFilter,
      });
    }

    const records = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter,
        sort: "-updatedAt",
        // ponytail: unbounded shelf query <- unbounded getFullList payload -> add cursor pagination and virtualization to personal shelf
        fields:
          "id,title,creator,coverUrl,status,mediaType,currentLabel,notes,progressCurrent,progressTotal,progressUnit,rating,isSharedWithCircles,moods,pace,externalSource,externalId,groupTitle,startedAt,completedAt,createdAt,updatedAt",
      });

    return records;
  } catch (err) {
    logDiagnostic(err, { action: "getPersonalShelf" });
    return [];
  }
}

export async function getTitleCircleProgress(
  titleId: string,
  title: TitlesResponse | null,
  groupId: string,
  session?: Session | null,
  access?: CircleAccess | null,
): Promise<TitleMemberProgressItem[]> {
  // P2-mirror hoist (H-1): the page already resolved session/access and the
  // title record (requireTitleInGroup) — skip the redundant getSession,
  // resolveCircleAccess, and title fetch when provided.
  const resolvedSession = session || (await getSession());
  const resolvedAccess = access || (await resolveCircleAccess(groupId, resolvedSession?.id));
  if (!resolvedAccess.isMember && !resolvedAccess.group.isPublic) {
    return [];
  }

  try {
    const pb = await getSuperuserClient();

    const [resolvedTitle, members] = await Promise.all([
      title
        ? Promise.resolve(title)
        : pb
            .collection("titles")
            .getFirstListItem<TitlesResponse>(
              pb.filter("id = {:titleId} && group = {:groupId}", { titleId, groupId }),
            )
            .catch(() => null),
      pb
        .collection("group_members")
        .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
          filter: pb.filter("group = {:groupId}", { groupId }),
          expand: "user",
        }),
    ]);

    if (!resolvedTitle) return [];

    const memberUserIds = members.map((m) => m.user);
    if (memberUserIds.length === 0) return [];

    // L5: custom rows carry no externalSource/externalId — only bind the
    // external clause when both exist so unbound params never reach the filter.
    // Scope to circle member IDs and project lean fields (R2-Q02).
    const userOrClause = memberUserIds.map((_, i) => `user = {:u${i}}`).join(" || ");
    const userParams = Object.fromEntries(memberUserIds.map((u, i) => [`u${i}`, u]));
    const baseFilter =
      resolvedTitle.externalSource && resolvedTitle.externalId
        ? `(groupTitle = {:titleId} || (externalSource = {:src} && externalId = {:extId})) && (${userOrClause})`
        : `groupTitle = {:titleId} && (${userOrClause})`;
    const filter = pb.filter(baseFilter, {
      titleId,
      src: resolvedTitle.externalSource || "",
      extId: resolvedTitle.externalId || "",
      ...userParams,
    });

    const progressRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter,
        fields:
          "id,user,groupTitle,status,progressCurrent,progressTotal,progressUnit,isSharedWithCircles,startedAt,completedAt,updatedAt",
      });

    const memberMap = new Map<string, PublicUser>();
    for (const m of members) {
      const user = pickReviewerUser(m.expand?.user);
      if (user) {
        memberMap.set(m.user, user);
      }
    }

    const result: TitleMemberProgressItem[] = [];
    for (const p of progressRecords) {
      const user = memberMap.get(p.user);
      if (user) {
        if (p.isSharedWithCircles !== false || p.user === resolvedSession?.id) {
          let percentage: number | undefined;
          if (p.status === "completed") {
            percentage = 100;
          } else if (
            typeof p.progressCurrent === "number" &&
            typeof p.progressTotal === "number" &&
            p.progressTotal > 0
          ) {
            percentage = Math.min(
              100,
              Math.round((p.progressCurrent / p.progressTotal) * 100),
            );
          }

          result.push({
            user,
            progress: p,
            percentage,
          });
        }
      }
    }

    return result;
  } catch (err) {
    logDiagnostic(err, { action: "getTitleCircleProgress", titleId, groupId });
    return [];
  }
}
