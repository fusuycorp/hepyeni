"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership } from "@/lib/membership";
import { extractErrorMessage, logDiagnostic } from "@/lib/errors";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
import { isSafeCoverUrl } from "@/lib/providers/validation";
import type { PublicUser } from "@/lib/group-titles";
import type { ActionResult } from "@/types/actions";
import type {
  TitlesMediaTypeOptions,
  TitlesResponse,
  UserMediaProgressRecord,
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";
import { toIsoDate } from "@/lib/date";
import {
  getPersonalShelf as getPersonalShelfQuery,
  getTitleCircleProgress as getTitleCircleProgressQuery,
  type TitleMemberProgressItem,
} from "@/lib/queries/progress";

export type { ActionResult, TitleMemberProgressItem };

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
) {
  const session = await getSession();
  if (!session) return [];
  return getPersonalShelfQuery(statusFilter, session);
}

async function resolveVerifiedGroupTitleId(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  groupTitleId: string | undefined,
  userId: string,
): Promise<string | undefined> {
  const trimmed = groupTitleId?.trim();
  if (!trimmed) return undefined;
  const titleRecord = await pb.collection("titles").getOne(trimmed);
  if (!titleRecord) return undefined;
  await requireMembership(titleRecord.group, userId);
  return trimmed;
}

async function findExistingMediaProgress(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  userId: string,
  input: SaveMediaProgressInput,
  cleanGroupTitleId?: string,
): Promise<UserMediaProgressResponse | null> {
  if (input.id) {
    return pb.collection("user_media_progress").getOne<UserMediaProgressResponse>(input.id);
  }
  if (input.externalSource && input.externalId) {
    return pb
      .collection("user_media_progress")
      .getFirstListItem<UserMediaProgressResponse>(
        pb.filter(
          "user = {:userId} && externalSource = {:source} && externalId = {:extId}",
          { userId, source: input.externalSource, extId: input.externalId },
        ),
      )
      .catch(() => null);
  }
  if (cleanGroupTitleId) {
    return pb
      .collection("user_media_progress")
      .getFirstListItem<UserMediaProgressResponse>(
        pb.filter("user = {:userId} && groupTitle = {:titleId}", {
          userId,
          titleId: cleanGroupTitleId,
        }),
      )
      .catch(() => null);
  }
  return null;
}

function sanitizeNullableString(val: string | undefined, max: number, trim = true): string | null {
  if (!val) return null;
  const normalized = trim ? val.trim() : val;
  return normalized ? normalized.slice(0, max) : null;
}

function sanitizeBoundedNumber(val: number | undefined, min: number): number | null {
  return typeof val === "number" && !isNaN(val) ? Math.max(min, val) : null;
}

function sanitizeRatingValue(rating: number | undefined): number | null {
  return typeof rating === "number" && rating >= 1 && rating <= 5 ? rating : null;
}

function applyProgressTimestamps(
  data: Record<string, unknown>,
  input: SaveMediaProgressInput,
  existing: UserMediaProgressResponse | null,
): void {
  const parsedStarted = toIsoDate(input.startedAt);
  if (parsedStarted) data.startedAt = parsedStarted;
  else if (existing?.startedAt) data.startedAt = existing.startedAt;
  else if (data.status === "in_progress") data.startedAt = new Date().toISOString();

  const parsedCompleted = toIsoDate(input.completedAt);
  if (parsedCompleted) data.completedAt = parsedCompleted;
  else if (data.status === "completed") data.completedAt = new Date().toISOString();
}

function sanitizeSafeCoverUrlField(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  return trimmed && isSafeCoverUrl(trimmed) ? trimmed.slice(0, 2000) : null;
}

function resolveSharedWithCirclesFlag(
  inputFlag: boolean | undefined,
  existing: UserMediaProgressResponse | null,
): boolean {
  if (inputFlag !== undefined) return inputFlag;
  return existing?.isSharedWithCircles ?? true;
}

function buildMediaProgressPayload(
  userId: string,
  cleanTitle: string,
  cleanGroupTitleId: string | undefined,
  input: SaveMediaProgressInput,
  existing: UserMediaProgressResponse | null,
): Record<string, unknown> {
  const normalizedMoods = normalizeMoods(input.moods);
  const data: Record<string, unknown> = {
    user: userId,
    mediaType: input.mediaType,
    title: cleanTitle.slice(0, 300),
    creator: sanitizeNullableString(input.creator, 300),
    coverUrl: sanitizeSafeCoverUrlField(input.coverUrl),
    externalSource: sanitizeNullableString(input.externalSource, 100, false),
    externalId: sanitizeNullableString(input.externalId, 200, false),
    status: input.status,
    progressCurrent: sanitizeBoundedNumber(input.progressCurrent, 0),
    progressTotal: sanitizeBoundedNumber(input.progressTotal, 1),
    progressUnit: input.progressUnit || null,
    currentLabel: sanitizeNullableString(input.currentLabel, 100),
    notes: sanitizeNullableString(input.notes, 3000),
    rating: sanitizeRatingValue(input.rating),
    moods: normalizedMoods.length > 0 ? normalizedMoods : null,
    pace: normalizePace(input.pace) ?? null,
    isSharedWithCircles: resolveSharedWithCirclesFlag(input.isSharedWithCircles, existing),
  };

  if (cleanGroupTitleId) {
    data.groupTitle = cleanGroupTitleId;
  }
  applyProgressTimestamps(data, input, existing);
  return data;
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
    const cleanGroupTitleId = await resolveVerifiedGroupTitleId(pb, input.groupTitleId, session.id);
    const existing = await findExistingMediaProgress(pb, session.id, input, cleanGroupTitleId);

    if (input.id && existing && existing.user !== session.id) {
      return { success: false, error: "You do not have permission to edit this record." };
    }

    const data = buildMediaProgressPayload(
      session.id,
      cleanTitle,
      cleanGroupTitleId,
      input,
      existing,
    );

    const collection = pb.collection("user_media_progress");
    const result = existing
      ? await collection.update<UserMediaProgressResponse>(existing.id, data)
      : await collection.create<UserMediaProgressResponse>(data);

    revalidatePath("/shelf");
    revalidatePath("/activity");
    if (input.groupTitleId) {
      revalidatePath("/groups");
    }

    return { success: true, data: result };
  } catch (err) {
    // ponytail: action messages <- plain English action errors -> map stable error codes to useTranslations on client
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

function buildQuickStepUpdate(
  existing: UserMediaProgressResponse,
  delta: number,
): Partial<UserMediaProgressRecord> {
  const unclamped = Math.max(0, (existing.progressCurrent ?? 0) + delta);
  const total = existing.progressTotal;
  const newCurrent = total && total > 0 ? Math.min(total, unclamped) : unclamped;
  const updateData: Partial<UserMediaProgressRecord> = { progressCurrent: newCurrent };

  if (total && newCurrent >= total && existing.status !== "completed") {
    updateData.status = "completed";
    updateData.completedAt = new Date().toISOString();
  }
  return updateData;
}

export async function updateProgressQuickStep(
  progressId: string,
  delta: number,
): Promise<ActionResult<UserMediaProgressResponse>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return { success: false, error: "Invalid progress step." };
  }

  try {
    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(progressId);

    if (existing.user !== session.id) {
      return { success: false, error: "You do not have permission to edit this record." };
    }

    const updateData = buildQuickStepUpdate(existing, delta);
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

export async function getTitleCircleProgress(
  titleId: string,
  _title: TitlesResponse | null,
  groupId: string,
): Promise<TitleMemberProgressItem[]> {
  const session = await getSession();
  if (!session) return [];
  return getTitleCircleProgressQuery(titleId, null, groupId, session);
}

export interface CircleLiveActivityItem {
  user: PublicUser;
  progress: UserMediaProgressResponse;
}

