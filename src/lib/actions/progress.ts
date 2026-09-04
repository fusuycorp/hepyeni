"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership } from "@/lib/membership";
import { extractErrorMessage, logDiagnostic } from "@/lib/errors";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
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

export async function getTitleCircleProgress(
  titleId: string,
  title: TitlesResponse | null,
  groupId: string,
): Promise<TitleMemberProgressItem[]> {
  const session = await getSession();
  if (!session) return [];
  return getTitleCircleProgressQuery(titleId, title, groupId, session);
}

export interface CircleLiveActivityItem {
  user: PublicUser;
  progress: UserMediaProgressResponse;
}

