"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { requireMembership, requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

export interface AddTitleOptions {
  moods?: MoodType[] | string[];
  pace?: PaceType | string;
}

export async function addTitle(
  groupId: string,
  mediaType: MediaType,
  result: NormalizedSearchResult,
  options?: AddTitleOptions,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in again" };
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    return { success: false, error: "Invalid media type" };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canPropose) {
      return { success: false, error: "You do not have permission to propose media in this circle" };
    }

    const title = String(result.title ?? "").slice(0, 300).trim();
    if (!title) {
      return { success: false, error: "Title is required" };
    }

    const externalSource = String(result.externalSource ?? "").slice(0, 100);
    const externalId = String(result.externalId ?? "").slice(0, 200);
    const creator = result.creator ? String(result.creator).slice(0, 300) : null;
    const coverUrl =
      result.coverUrl && /^https?:\/\//i.test(result.coverUrl)
        ? result.coverUrl.slice(0, 2000)
        : null;

    const normalizedMoods = normalizeMoods(options?.moods ?? result.metadata?.moods);
    const normalizedPace = normalizePace(options?.pace ?? result.metadata?.pace);
    const metadata: Record<string, unknown> | null = {
      ...(result.metadata ?? {}),
      ...(normalizedMoods.length > 0 ? { moods: normalizedMoods } : {}),
      ...(normalizedPace ? { pace: normalizedPace } : {}),
    };

    const pb = await getSuperuserClient();
    try {
      await pb.collection("titles").create({
        group: groupId,
        mediaType,
        externalSource,
        externalId,
        title,
        creator,
        coverUrl,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        status: "proposed",
        addedBy: session.id,
      });
      revalidatePath(`/groups/${groupId}`);
      return { success: true, data: undefined };
    } catch (err) {
      if (isValidationNotUnique(err)) {
        return { success: true, data: undefined };
      }
      throw err;
    }
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addTitle", groupId, mediaType });
    return { success: false, error: "Failed to add title to group", traceId: diag.traceId };
  }
}

export type CustomTitleInput = {
  title: string;
  creator?: string;
  coverUrl?: string;
  description?: string;
  moods?: MoodType[] | string[];
  pace?: PaceType | string;
};

export async function addCustomTitle(
  groupId: string,
  mediaType: MediaType,
  data: CustomTitleInput,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in again" };
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    return { success: false, error: "Invalid media type" };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canPropose) {
      return { success: false, error: "You do not have permission to propose media in this circle" };
    }

    const cleanTitle = String(data.title ?? "").slice(0, 300).trim();
    if (!cleanTitle) {
      return { success: false, error: "Title is required" };
    }

    const cleanCreator = data.creator
      ? String(data.creator).slice(0, 300).trim() || null
      : null;
    const cleanCover =
      data.coverUrl && /^https?:\/\//i.test(data.coverUrl.trim())
        ? data.coverUrl.trim().slice(0, 2000)
        : null;
    const cleanDesc = data.description
      ? String(data.description).slice(0, 1000).trim()
      : undefined;

    const customId = `custom_${crypto.randomUUID()}`;

    const normalizedMoods = normalizeMoods(data.moods);
    const normalizedPace = normalizePace(data.pace);
    const metadata: Record<string, unknown> = {
      ...(cleanDesc ? { description: cleanDesc } : {}),
      custom: true,
      ...(normalizedMoods.length > 0 ? { moods: normalizedMoods } : {}),
      ...(normalizedPace ? { pace: normalizedPace } : {}),
    };

    const pb = await getSuperuserClient();
    await pb.collection("titles").create({
      group: groupId,
      mediaType,
      externalSource: "custom",
      externalId: customId,
      title: cleanTitle,
      creator: cleanCreator,
      coverUrl: cleanCover,
      metadata,
      status: "proposed",
      addedBy: session.id,
    });

    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addCustomTitle", groupId, mediaType });
    return { success: false, error: "Failed to create custom title", traceId: diag.traceId };
  }
}

export async function startConsuming(
  titleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in again" };
  }

  try {
    const [, titleRecord] = await Promise.all([
      requireMembership(groupId, session.id),
      requireTitleInGroup(titleId, groupId),
    ]);

    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getFirstListItem(
        pb.filter("user = {:userId} && groupTitle = {:titleId}", {
          userId: session.id,
          titleId,
        }),
      )
      .catch(() => null);

    const now = new Date().toISOString();

    if (existing) {
      await pb.collection("user_media_progress").update(existing.id, {
        status: "in_progress",
        startedAt: existing.startedAt || now,
        completedAt: null,
      });
    } else {
      await pb.collection("user_media_progress").create({
        user: session.id,
        groupTitle: titleId,
        mediaType: titleRecord.mediaType,
        title: titleRecord.title,
        creator: titleRecord.creator,
        coverUrl: titleRecord.coverUrl,
        externalSource: titleRecord.externalSource,
        externalId: titleRecord.externalId,
        status: "in_progress",
        startedAt: now,
        isSharedWithCircles: true,
      });
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    revalidatePath("/shelf");
    revalidatePath("/activity");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "startConsuming", titleId, groupId });
    return { success: false, error: "Failed to start consuming title", traceId: diag.traceId };
  }
}

export async function markConsumed(
  titleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in again" };
  }

  try {
    // M-4: independent reads — membership and title-in-group in parallel.
    const [, titleRecord] = await Promise.all([
      requireMembership(groupId, session.id),
      requireTitleInGroup(titleId, groupId),
    ]);

    const pb = await getSuperuserClient();
    const now = new Date().toISOString();

    const existing = await pb
      .collection("user_media_progress")
      .getFirstListItem(
        pb.filter("user = {:userId} && groupTitle = {:titleId}", {
          userId: session.id,
          titleId,
        }),
      )
      .catch(() => null);

    if (existing) {
      await pb.collection("user_media_progress").update(existing.id, {
        status: "completed",
        completedAt: now,
      });
    } else {
      await pb.collection("user_media_progress").create({
        user: session.id,
        groupTitle: titleId,
        mediaType: titleRecord.mediaType,
        title: titleRecord.title,
        creator: titleRecord.creator,
        coverUrl: titleRecord.coverUrl,
        externalSource: titleRecord.externalSource,
        externalId: titleRecord.externalId,
        status: "completed",
        startedAt: titleRecord.createdAt || now,
        completedAt: now,
        isSharedWithCircles: true,
      });
    }

    // Check if all circle members have now completed this title
    const members = await pb.collection("group_members").getFullList({
      filter: pb.filter("group = {:groupId}", { groupId }),
    });
    if (members.length > 0) {
      const allCompletedProgress = await pb
        .collection("user_media_progress")
        .getFullList({
          filter: pb.filter("groupTitle = {:titleId} && status = 'completed'", {
            titleId,
          }),
        });
      const completedUserIds = new Set(allCompletedProgress.map((p) => p.user));
      const allMembersFinished = members.every((m) => completedUserIds.has(m.user));

      if (allMembersFinished) {
        await pb.collection("titles").update(titleId, {
          status: "consumed",
          consumedAt: now,
        });
      }
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    revalidatePath("/shelf");
    revalidatePath("/activity");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "markConsumed", titleId, groupId });
    return { success: false, error: "Failed to mark title as finished", traceId: diag.traceId };
  }
}

export async function unmarkConsumed(
  titleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in again" };
  }

  try {
    // M-4: independent reads — membership and title-in-group in parallel.
    await Promise.all([
      requireMembership(groupId, session.id),
      requireTitleInGroup(titleId, groupId),
    ]);

    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getFirstListItem(
        pb.filter("user = {:userId} && groupTitle = {:titleId}", {
          userId: session.id,
          titleId,
        }),
      )
      .catch(() => null);

    if (existing) {
      await pb.collection("user_media_progress").update(existing.id, {
        status: "in_progress",
        completedAt: null,
      });
    }

    // If title was marked consumed at title level, demote back to proposed
    await pb.collection("titles").update(titleId, {
      status: "proposed",
      consumedAt: null,
    }).catch(() => null);

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    revalidatePath("/shelf");
    revalidatePath("/activity");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "unmarkConsumed", titleId, groupId });
    return { success: false, error: "Failed to move title back to backlog", traceId: diag.traceId };
  }
}
