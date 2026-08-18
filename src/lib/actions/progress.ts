"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { resolveCircleAccess, requireMembership } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import { normalizeMoods, normalizePace, type MoodType, type PaceType } from "@/lib/moods";
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

function extractErrorMessage(err: unknown, fallback: string): string {
  const errObj = err as { data?: { message?: string; data?: Record<string, { message?: string }> }; message?: string };
  if (errObj?.data?.data) {
    const fieldErrors = Object.entries(errObj.data.data)
      .map(([field, detail]) => `${field}: ${detail?.message || "Invalid"}`)
      .join(", ");
    if (fieldErrors) return fieldErrors;
  }
  return errObj?.data?.message || errObj?.message || fallback;
}

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

  try {
    const pb = await getSuperuserClient();
    let filter = pb.filter("user = {:userId}", { userId: session.id });
    if (statusFilter) {
      filter += ` && status = "${statusFilter}"`;
    }

    const records = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter,
        sort: "-updatedAt",
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
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  const cleanTitle = input.title?.trim();
  if (!cleanTitle) {
    return { success: false, error: "Başlık alanı boş bırakılamaz." };
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
        return { success: false, error: "Bu kaydı düzenleme yetkiniz yok." };
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
    const diag = logDiagnostic(err, { action: "saveMediaProgress", input });
    const userMsg = extractErrorMessage(err, "Kayıt kaydedilirken bir hata oluştu.");
    return { success: false, error: userMsg, traceId: diag.traceId };
  }
}

export async function updateProgressQuickStep(
  progressId: string,
  delta: number,
): Promise<ActionResult<UserMediaProgressResponse>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(progressId);

    if (existing.user !== session.id) {
      return { success: false, error: "Bu kaydı düzenleme yetkiniz yok." };
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
    return { success: false, error: "İlerleme adımı güncellenemedi.", traceId: diag.traceId };
  }
}

export async function deleteMediaProgress(
  progressId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    const pb = await getSuperuserClient();
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(progressId);

    if (existing.user !== session.id) {
      return { success: false, error: "Bu kaydı silme yetkiniz yok." };
    }

    await pb.collection("user_media_progress").delete(progressId);
    revalidatePath("/shelf");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteMediaProgress", progressId });
    return { success: false, error: "Kayıt silinemedi.", traceId: diag.traceId };
  }
}

export interface TitleMemberProgressItem {
  user: UsersResponse;
  progress: UserMediaProgressResponse;
  percentage?: number;
}

export async function getTitleCircleProgress(
  titleId: string,
  groupId: string,
): Promise<TitleMemberProgressItem[]> {
  const session = await getSession();
  const access = await resolveCircleAccess(groupId, session?.id);
  if (!access.isMember && !access.group.isPublic) {
    return [];
  }

  try {
    const pb = await getSuperuserClient();

    const [title, members] = await Promise.all([
      pb
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

    if (!title) return [];

    const memberUserIds = members.map((m) => m.user);
    if (memberUserIds.length === 0) return [];

    const filter = pb.filter(
      "groupTitle = {:titleId} || (externalSource = {:src} && externalId = {:extId})",
      {
        titleId,
        src: title.externalSource,
        extId: title.externalId,
      },
    );

    const progressRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse<{ user?: UsersResponse }>>({
        filter,
        expand: "user",
      });

    const memberMap = new Map<string, UsersResponse>();
    for (const m of members) {
      if (m.expand?.user) {
        memberMap.set(m.user, m.expand.user);
      }
    }

    const result: TitleMemberProgressItem[] = [];
    for (const p of progressRecords) {
      if (memberMap.has(p.user)) {
        if (p.isSharedWithCircles !== false || p.user === session?.id) {
          const user = memberMap.get(p.user)!;
          let percentage: number | undefined;
          if (p.status === "completed") {
            percentage = 100;
          } else if (
            p.progressCurrent &&
            p.progressTotal &&
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
  user: UsersResponse;
  progress: UserMediaProgressResponse;
}

export async function getCircleLiveActivity(
  groupId: string,
): Promise<CircleLiveActivityItem[]> {
  const session = await getSession();
  const access = await resolveCircleAccess(groupId, session?.id);
  if (!access.isMember && !access.group.isPublic) {
    return [];
  }

  try {
    const pb = await getSuperuserClient();
    const members = await pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      });

    const memberMap = new Map<string, UsersResponse>();
    for (const m of members) {
      if (m.expand?.user) {
        memberMap.set(m.user, m.expand.user);
      }
    }

    if (memberMap.size === 0) return [];

    const activeProgress = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter: 'status = "in_progress" && isSharedWithCircles != false',
        sort: "-updatedAt",
      });

    const result: CircleLiveActivityItem[] = [];
    for (const p of activeProgress) {
      if (memberMap.has(p.user)) {
        result.push({
          user: memberMap.get(p.user)!,
          progress: p,
        });
      }
    }

    return result;
  } catch (err) {
    logDiagnostic(err, { action: "getCircleLiveActivity", groupId });
    return [];
  }
}
