"use server";

import { revalidatePath } from "next/cache";
import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  resolveCircleAccess,
  requireMembership,
  type CircleAccess,
} from "@/lib/membership";
import { extractErrorMessage, logDiagnostic } from "@/lib/errors";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";
import type { ActionResult } from "@/types/actions";
import type {
  GroupMembersResponse,
  TitlesMediaTypeOptions,
  TitlesResponse,
  UserMediaProgressRecord,
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
  UsersResponse,
} from "@/types/pocketbase-types";
import { toIsoDate } from "@/lib/date";

export type { ActionResult };

export interface SaveMediaProgressInput {
  id?: string;
  groupTitleId?: string;
  mediaType: TitlesMediaTypeOptions;
  externalSource?: string;
  externalId?: string;
  title: string;
  creator?: string;
  coverUrl?: string;
  status: UserMediaProgressStatusOptions;
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: UserMediaProgressUnitOptions;
  currentLabel?: string;
  notes?: string;
  rating?: number;
  moods?: MoodType[] | string[] | null;
  pace?: PaceType | string | null;
  isSharedWithCircles?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export async function getPersonalShelf(
  statusFilter?: UserMediaProgressStatusOptions,
  session?: Session | null,
) {
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
        // ponytail: project only the fields the shelf UI reads (M6). The real
        // win is pagination/virtualization of the unbounded shelf (deferred).
        fields:
          "id,title,creator,coverUrl,status,mediaType,currentLabel,notes,progressCurrent,progressTotal,progressUnit,rating,isSharedWithCircles,moods,pace,externalSource,externalId,groupTitle,startedAt,completedAt,createdAt,updatedAt",
      });

    return records;
  } catch (err) {
    logDiagnostic(err, { action: "getPersonalShelf" });
    return [];
  }
}

export async function saveMediaProgress(
  input: SaveMediaProgressInput,
): Promise<ActionResult<UserMediaProgressResponse>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  const cleanTitle = input.title?.trim();
  if (!cleanTitle) {
    return { success: false, error: "Title is required." };
  }

  try {
    const pb = await getSuperuserClient();

    const normalizedMoods = normalizeMoods(input.moods);
    const normalizedPace = normalizePace(input.pace);

    const data: Record<string, unknown> = {
      user: session.id,
      mediaType: input.mediaType,
      title: cleanTitle.slice(0, 300),
      creator: input.creator ? input.creator.trim().slice(0, 300) : null,
      coverUrl: input.coverUrl ? input.coverUrl.trim().slice(0, 2000) : null,
      externalSource: input.externalSource ? input.externalSource.slice(0, 100) : null,
      externalId: input.externalId ? input.externalId.slice(0, 200) : null,
      status: input.status,
      progressCurrent:
        typeof input.progressCurrent === "number" && !isNaN(input.progressCurrent)
          ? Math.max(0, input.progressCurrent)
          : null,
      progressTotal:
        typeof input.progressTotal === "number" && !isNaN(input.progressTotal)
          ? Math.max(1, input.progressTotal)
          : null,
      progressUnit: input.progressUnit || null,
      currentLabel: input.currentLabel ? input.currentLabel.trim().slice(0, 100) : null,
      notes: input.notes ? input.notes.trim().slice(0, 3000) : null,
      rating:
        typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
          ? input.rating
          : null,
      moods: normalizedMoods.length > 0 ? normalizedMoods : null,
      pace: normalizedPace || null,
      isSharedWithCircles: input.isSharedWithCircles ?? true,
    };

    if (input.groupTitleId && input.groupTitleId.trim()) {
      const cleanGroupTitleId = input.groupTitleId.trim();
      const titleRecord = await pb.collection("titles").getOne(cleanGroupTitleId);
      if (titleRecord) {
        await requireMembership(titleRecord.group, session.id);
        data.groupTitle = cleanGroupTitleId;
      }
    }

    const parsedStarted = toIsoDate(input.startedAt);
    if (parsedStarted) data.startedAt = parsedStarted;
    else if (data.status === "in_progress") data.startedAt = new Date().toISOString();

    const parsedCompleted = toIsoDate(input.completedAt);
    if (parsedCompleted) data.completedAt = parsedCompleted;
    else if (data.status === "completed") data.completedAt = new Date().toISOString();

    let result: UserMediaProgressResponse;

    if (input.id) {
      const existing = await pb
        .collection("user_media_progress")
        .getOne<UserMediaProgressResponse>(input.id);
      if (existing.user !== session.id) {
        return { success: false, error: "You do not have permission to edit this record." };
      }
      result = await pb
        .collection("user_media_progress")
        .update<UserMediaProgressResponse>(input.id, data);
    } else {
      let existingItem: UserMediaProgressResponse | null = null;
      if (input.externalSource && input.externalId) {
        existingItem = await pb
          .collection("user_media_progress")
          .getFirstListItem<UserMediaProgressResponse>(
            pb.filter(
              "user = {:userId} && externalSource = {:source} && externalId = {:extId}",
              {
                userId: session.id,
                source: input.externalSource,
                extId: input.externalId,
              },
            ),
          )
          .catch(() => null);
      }

      if (existingItem) {
        result = await pb
          .collection("user_media_progress")
          .update<UserMediaProgressResponse>(existingItem.id, data);
      } else {
        result = await pb
          .collection("user_media_progress")
          .create<UserMediaProgressResponse>(data);
      }
    }

    revalidatePath("/shelf");
    revalidatePath("/activity");
    if (input.groupTitleId) {
      revalidatePath("/groups");
    }

    return { success: true, data: result };
  } catch (err) {
    // ponytail: action messages are plain English today; the upgrade path is a
    // stable error-code + client-side i18n mapping (i18n parity invariant).
    const diag = logDiagnostic(err, {
      action: "saveMediaProgress",
      userId: session.id,
      mediaType: input.mediaType,
      status: input.status,
    });
    const userMsg = extractErrorMessage(
      err,
      "An error occurred while saving your progress.",
    );
    return { success: false, error: userMsg, traceId: diag.traceId };
  }
}

export async function updateProgressQuickStep(
  progressId: string,
  delta: number,
): Promise<ActionResult<UserMediaProgressResponse>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(progressId);

    if (existing.user !== session.id) {
      return { success: false, error: "You do not have permission to edit this record." };
    }

    const current = existing.progressCurrent ?? 0;
    const newCurrent = Math.max(0, current + delta);
    const updateData: Partial<UserMediaProgressRecord> = {
      progressCurrent: newCurrent,
    };

    if (
      existing.progressTotal &&
      newCurrent >= existing.progressTotal &&
      existing.status !== "completed"
    ) {
      updateData.status = "completed";
      updateData.completedAt = new Date().toISOString();
    }

    const updated = await pb
      .collection("user_media_progress")
      .update<UserMediaProgressResponse>(progressId, updateData);

    revalidatePath("/shelf");
    return { success: true, data: updated };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "updateProgressQuickStep", progressId, delta });
    return { success: false, error: "Unable to update progress.", traceId: diag.traceId };
  }
}

export async function deleteMediaProgress(
  progressId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(progressId);

    if (existing.user !== session.id) {
      return { success: false, error: "You do not have permission to delete this record." };
    }

    await pb.collection("user_media_progress").delete(progressId);
    revalidatePath("/shelf");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteMediaProgress", progressId });
    return { success: false, error: "Unable to delete the record.", traceId: diag.traceId };
  }
}

export interface TitleMemberProgressItem {
  // R2: projected to id/name/avatarUrl — member emails never reach the client.
  user: PublicUser;
  progress: UserMediaProgressResponse;
  percentage?: number;
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
    const filter =
      resolvedTitle.externalSource && resolvedTitle.externalId
        ? pb.filter(
            "groupTitle = {:titleId} || (externalSource = {:src} && externalId = {:extId})",
            {
              titleId,
              src: resolvedTitle.externalSource,
              extId: resolvedTitle.externalId,
            },
          )
        : pb.filter("groupTitle = {:titleId}", { titleId });

    const progressRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter,
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

export interface CircleLiveActivityItem {
  user: PublicUser;
  progress: UserMediaProgressResponse;
}

