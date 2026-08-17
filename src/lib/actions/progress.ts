"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, resolveCircleAccess } from "@/lib/membership";
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
    console.error("[getPersonalShelf Error]:", err);
    return [];
  }
}

export async function saveMediaProgress(input: SaveMediaProgressInput) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const pb = await getSuperuserClient();

  const data: Partial<UserMediaProgressRecord> = {
    user: session.id,
    mediaType: input.mediaType,
    title: input.title.trim().slice(0, 300),
    creator: input.creator ? input.creator.trim().slice(0, 300) : undefined,
    coverUrl: input.coverUrl ? input.coverUrl.trim().slice(0, 2000) : undefined,
    externalSource: input.externalSource?.slice(0, 100),
    externalId: input.externalId?.slice(0, 200),
    groupTitle: input.groupTitleId || undefined,
    status: input.status,
    progressCurrent:
      typeof input.progressCurrent === "number" && !isNaN(input.progressCurrent)
        ? Math.max(0, input.progressCurrent)
        : undefined,
    progressTotal:
      typeof input.progressTotal === "number" && !isNaN(input.progressTotal)
        ? Math.max(1, input.progressTotal)
        : undefined,
    progressUnit: input.progressUnit || undefined,
    currentLabel: input.currentLabel ? input.currentLabel.trim().slice(0, 100) : undefined,
    notes: input.notes ? input.notes.trim().slice(0, 3000) : undefined,
    rating:
      typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
        ? input.rating
        : undefined,
    isSharedWithCircles: input.isSharedWithCircles ?? true,
    startedAt: input.startedAt || undefined,
    completedAt: input.completedAt || undefined,
  };

  if (data.status === "completed" && !data.completedAt) {
    data.completedAt = new Date().toISOString();
  }
  if (data.status === "in_progress" && !data.startedAt) {
    data.startedAt = new Date().toISOString();
  }

  let result: UserMediaProgressResponse;

  if (input.id) {
    // Verify ownership
    const existing = await pb
      .collection("user_media_progress")
      .getOne<UserMediaProgressResponse>(input.id);
    if (existing.user !== session.id) {
      throw new Error("Forbidden");
    }
    result = await pb
      .collection("user_media_progress")
      .update<UserMediaProgressResponse>(input.id, data);
  } else {
    // Check if progress already exists for this user + externalId/groupTitle
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
    revalidatePath(`/groups`);
  }

  return result;
}

export async function updateProgressQuickStep(
  progressId: string,
  delta: number,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const pb = await getSuperuserClient();
  const existing = await pb
    .collection("user_media_progress")
    .getOne<UserMediaProgressResponse>(progressId);

  if (existing.user !== session.id) throw new Error("Forbidden");

  const current = existing.progressCurrent ?? 0;
  const newCurrent = Math.max(0, current + delta);
  const updateData: Partial<UserMediaProgressRecord> = {
    progressCurrent: newCurrent,
  };

  // Auto-complete if reached total
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
  return updated;
}

export async function deleteMediaProgress(progressId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const pb = await getSuperuserClient();
  const existing = await pb
    .collection("user_media_progress")
    .getOne<UserMediaProgressResponse>(progressId);

  if (existing.user !== session.id) throw new Error("Forbidden");

  await pb.collection("user_media_progress").delete(progressId);
  revalidatePath("/shelf");
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

  const pb = await getSuperuserClient();

  const [title, members] = await Promise.all([
    pb.collection("titles").getOne<TitlesResponse>(titleId).catch(() => null),
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

  // Query progress records by groupTitleId OR by matching externalSource/externalId
  const filter = pb.filter(
    "groupTitle = {:titleId} || (externalSource = {:src} && externalId = {:extId})",
    {
      titleId,
      src: title.externalSource,
      extId: title.externalId,
    },
  );

  let progressRecords: UserMediaProgressResponse<{ user?: UsersResponse }>[] = [];
  try {
    progressRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse<{ user?: UsersResponse }>>({
        filter,
        expand: "user",
      });
  } catch (err) {
    console.error("[getTitleCircleProgress Error]:", err);
    return [];
  }

  const memberMap = new Map<string, UsersResponse>();
  for (const m of members) {
    if (m.expand?.user) {
      memberMap.set(m.user, m.expand.user);
    }
  }

  const result: TitleMemberProgressItem[] = [];

  for (const p of progressRecords) {
    if (memberMap.has(p.user)) {
      // Privacy check: only show if isSharedWithCircles is true OR it's the requesting user
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

  try {
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
    console.error("[getCircleLiveActivity Error]:", err);
    return [];
  }
}
