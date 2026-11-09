"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { requireMembership, requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import { isSafeCoverUrl } from "@/lib/providers/validation";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";

export interface AddTitleOptions {
  moods?: MoodType[] | string[];
  pace?: PaceType | string;
}

function sanitizeOptionalCoverUrl(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  return trimmed && isSafeCoverUrl(trimmed) ? trimmed.slice(0, 2000) : null;
}

function buildTitleMetadata(
  baseMetadata: Record<string, unknown> | undefined,
  rawMoods: unknown,
  rawPace: unknown,
): Record<string, unknown> | null {
  const normalizedMoods = normalizeMoods(rawMoods);
  const normalizedPace = normalizePace(rawPace);
  const metadata: Record<string, unknown> = {
    ...(baseMetadata ?? {}),
    ...(normalizedMoods.length > 0 ? { moods: normalizedMoods } : {}),
    ...(normalizedPace ? { pace: normalizedPace } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : null;
}

function sanitizeNonEmptyText(val: unknown, max: number): string {
  return typeof val === "string" ? val.slice(0, max).trim() : "";
}

function resolveTitleMetadataFromOptions(
  result: NormalizedSearchResult,
  options?: AddTitleOptions,
): Record<string, unknown> | null {
  const baseMeta = result.metadata;
  return buildTitleMetadata(
    baseMeta,
    options ? options.moods : baseMeta?.moods,
    options ? options.pace : baseMeta?.pace,
  );
}

function parseProviderTitleFields(
  result: NormalizedSearchResult,
  options?: AddTitleOptions,
):
  | {
      ok: true;
      title: string;
      externalSource: string;
      externalId: string;
      creator: string | null;
      coverUrl: string | null;
      metadata: Record<string, unknown> | null;
    }
  | { ok: false; error: string } {
  const title = sanitizeNonEmptyText(result.title, 300);
  if (!title) return { ok: false, error: "Title is required" };

  const externalSource = sanitizeNonEmptyText(result.externalSource, 100);
  const externalId = sanitizeNonEmptyText(result.externalId, 200);
  if (!externalSource || !externalId) {
    return { ok: false, error: "External source and ID are required" };
  }

  return {
    ok: true,
    title,
    externalSource,
    externalId,
    creator: result.creator ? String(result.creator).slice(0, 300) : null,
    coverUrl: sanitizeOptionalCoverUrl(result.coverUrl),
    metadata: resolveTitleMetadataFromOptions(result, options),
  };
}

export async function addTitle(
  groupId: string,
  mediaType: MediaType,
  result: NormalizedSearchResult,
  options?: AddTitleOptions,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in again" };
  if (!MEDIA_TYPES.includes(mediaType)) return { success: false, error: "Invalid media type" };

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canPropose) {
      return { success: false, error: "You do not have permission to propose media in this circle" };
    }

    const parsed = parseProviderTitleFields(result, options);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const pb = await getSuperuserClient();
    try {
      await pb.collection("titles").create({
        group: groupId,
        mediaType,
        externalSource: parsed.externalSource,
        externalId: parsed.externalId,
        title: parsed.title,
        creator: parsed.creator,
        coverUrl: parsed.coverUrl,
        metadata: parsed.metadata,
        status: "proposed",
        addedBy: session.id,
      });
      revalidatePath(`/groups/${groupId}`);
      return { success: true, data: undefined };
    } catch (err) {
      if (isValidationNotUnique(err)) return { success: true, data: undefined };
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

function buildCustomTitleRecord(
  groupId: string,
  mediaType: MediaType,
  userId: string,
  cleanTitle: string,
  data: CustomTitleInput,
): Record<string, unknown> {
  const cleanCreator = data.creator ? String(data.creator).slice(0, 300).trim() || null : null;
  const cleanDesc = data.description ? String(data.description).slice(0, 1000).trim() : undefined;
  const baseMetadata: Record<string, unknown> = {
    ...(cleanDesc ? { description: cleanDesc } : {}),
    custom: true,
  };

  return {
    group: groupId,
    mediaType,
    externalSource: "custom",
    externalId: `custom_${crypto.randomUUID()}`,
    title: cleanTitle,
    creator: cleanCreator,
    coverUrl: sanitizeOptionalCoverUrl(data.coverUrl),
    metadata: buildTitleMetadata(baseMetadata, data.moods, data.pace),
    status: "proposed",
    addedBy: userId,
  };
}

export async function addCustomTitle(
  groupId: string,
  mediaType: MediaType,
  data: CustomTitleInput,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in again" };
  if (!MEDIA_TYPES.includes(mediaType)) return { success: false, error: "Invalid media type" };

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canPropose) {
      return { success: false, error: "You do not have permission to propose media in this circle" };
    }

    const cleanTitle = String(data.title ?? "").slice(0, 300).trim();
    if (!cleanTitle) return { success: false, error: "Title is required" };

    const pb = await getSuperuserClient();
    await pb
      .collection("titles")
      .create(buildCustomTitleRecord(groupId, mediaType, session.id, cleanTitle, data));

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

    // Check if all circle members have now completed this title (ignoring opted-out private rows)
    const members = await pb.collection("group_members").getFullList({
      filter: pb.filter("group = {:groupId}", { groupId }),
    });
    if (members.length > 0) {
      const allCompletedProgress = await pb
        .collection("user_media_progress")
        .getFullList({
          filter: pb.filter(
            "groupTitle = {:titleId} && status = 'completed' && isSharedWithCircles != false",
            {
              titleId,
            },
          ),
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
    const [membership] = await Promise.all([
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
    // only when the user actually had a progress record or is owner/admin
    if (existing || membership.role === "owner" || session.isAdmin) {
      await pb
        .collection("titles")
        .update(titleId, {
          status: "proposed",
          consumedAt: null,
        })
        .catch(() => null);
    }

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
