"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  requireMembership,
  requireMilestoneInGroup,
  requireScheduleInGroup,
  requireTitleInGroup,
  resolveCircleAccess,
} from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type {
  GroupSchedulesRecord,
  GroupSchedulesResponse,
  GroupSchedulesStatusOptions,
  MilestoneCheckinsResponse,
  MilestoneCommentsResponse,
  ScheduleMilestonesRecord,
  ScheduleMilestonesResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export type { ActionResult };

export interface MilestoneCommentItem {
  id: string;
  milestone: string;
  user: string;
  group: string;
  content?: string;
  isSpoiler?: boolean;
  createdAt: string;
  isLocked?: boolean;
  author?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

export interface MilestoneCommentsResult {
  comments: MilestoneCommentItem[];
  isLocked: boolean;
  lockedCount: number;
  hasCheckedIn: boolean;
}

function toIsoDate(val?: string | null): string | null {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

export interface CreateScheduleMilestoneInput {
  title: string;
  targetDate?: string;
  targetUnit?: string;
}

export interface CreateGroupScheduleInput {
  name: string;
  description?: string;
  titleId?: string;
  startDate?: string;
  targetDate?: string;
  milestones: CreateScheduleMilestoneInput[];
}

export interface MilestoneWithCheckins extends ScheduleMilestonesResponse {
  checkins: MilestoneCheckinsResponse<{ user?: UsersResponse }>[];
  hasCheckedIn: boolean;
  commentCount: number;
}

export interface GroupScheduleWithMilestones extends GroupSchedulesResponse {
  titleRecord?: TitlesResponse;
  creator?: UsersResponse;
  milestones: MilestoneWithCheckins[];
}

export async function getGroupSchedules(
  groupId: string,
): Promise<GroupScheduleWithMilestones[]> {
  const session = await getSession();
  const access = await resolveCircleAccess(groupId, session?.id);
  if (!access.isMember && !access.group.isPublic) {
    return [];
  }

  try {
    const pb = await getSuperuserClient();

    const schedules = await pb
      .collection("group_schedules")
      .getFullList<GroupSchedulesResponse<{ title?: TitlesResponse; createdBy?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "title,createdBy",
        sort: "-createdAt",
      });

    if (schedules.length === 0) return [];

    const scheduleIds = schedules.map((s) => s.id);

    // Fetch all milestones for these schedules
    const allMilestones = await pb
      .collection("schedule_milestones")
      .getFullList<ScheduleMilestonesResponse>({
        filter: scheduleIds.map((id) => `schedule = "${id}"`).join(" || "),
        sort: "orderIndex",
      });

    const milestoneIds = allMilestones.map((m) => m.id);

    // Fetch all checkins for these milestones
    let allCheckins: MilestoneCheckinsResponse<{ user?: UsersResponse }>[] = [];
    let allComments: MilestoneCommentsResponse[] = [];
    if (milestoneIds.length > 0) {
      const milestoneFilter = milestoneIds.map((id) => `milestone = "${id}"`).join(" || ");
      const [checkinsRes, commentsRes] = await Promise.all([
        pb.collection("milestone_checkins").getFullList<MilestoneCheckinsResponse<{ user?: UsersResponse }>>({
          filter: milestoneFilter,
          expand: "user",
        }),
        pb.collection("milestone_comments").getFullList<MilestoneCommentsResponse>({
          filter: milestoneFilter,
        }),
      ]);
      allCheckins = checkinsRes;
      allComments = commentsRes;
    }

    const checkinsByMilestone = new Map<
      string,
      MilestoneCheckinsResponse<{ user?: UsersResponse }>[]
    >();
    for (const c of allCheckins) {
      const list = checkinsByMilestone.get(c.milestone) || [];
      list.push(c);
      checkinsByMilestone.set(c.milestone, list);
    }

    const commentCountsByMilestone = new Map<string, number>();
    for (const comment of allComments) {
      const count = commentCountsByMilestone.get(comment.milestone) || 0;
      commentCountsByMilestone.set(comment.milestone, count + 1);
    }

    const milestonesBySchedule = new Map<string, MilestoneWithCheckins[]>();
    for (const m of allMilestones) {
      const checkins = checkinsByMilestone.get(m.id) || [];
      const hasCheckedIn = session?.id
        ? checkins.some((c) => c.user === session.id)
        : false;
      const commentCount = commentCountsByMilestone.get(m.id) || 0;

      const list = milestonesBySchedule.get(m.schedule) || [];
      list.push({
        ...m,
        checkins,
        hasCheckedIn,
        commentCount,
      });
      milestonesBySchedule.set(m.schedule, list);
    }

    return schedules.map((s) => ({
      ...s,
      titleRecord: s.expand?.title,
      creator: s.expand?.createdBy,
      milestones: milestonesBySchedule.get(s.id) || [],
    }));
  } catch (err) {
    logDiagnostic(err, { action: "getGroupSchedules", groupId });
    return [];
  }
}

export async function createGroupSchedule(
  groupId: string,
  input: CreateGroupScheduleInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  // Require circle membership or admin
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isMember && !session.isAdmin) {
    return { success: false, error: "Bu çemberde program oluşturma yetkiniz bulunmuyor." };
  }

  const cleanName = input.name?.trim();
  if (!cleanName) {
    return { success: false, error: "Lütfen bir program adı belirtin." };
  }

  const validMilestones = (input.milestones || []).filter((m) => m.title && m.title.trim().length > 0);
  if (validMilestones.length === 0) {
    return { success: false, error: "En az bir geçerli kontrol noktası eklenmelidir." };
  }

  const pb = await getSuperuserClient();

  const scheduleData: Record<string, unknown> = {
    group: groupId,
    name: cleanName.slice(0, 200),
    description: input.description ? input.description.trim().slice(0, 1000) : null,
    status: "active",
    createdBy: session.id,
  };

  // Only assign relation/date if valid non-empty
  if (input.titleId && input.titleId.trim()) {
    try {
      await requireTitleInGroup(input.titleId.trim(), groupId);
      scheduleData.title = input.titleId.trim();
    } catch (err) {
      return { success: false, error: "Seçilen medya bu çembere ait değil." };
    }
  }
  const parsedStartDate = toIsoDate(input.startDate);
  if (parsedStartDate) {
    scheduleData.startDate = parsedStartDate;
  }
  const parsedTargetDate = toIsoDate(input.targetDate);
  if (parsedTargetDate) {
    scheduleData.targetDate = parsedTargetDate;
  }

  try {
    const schedule = await pb
      .collection("group_schedules")
      .create<GroupSchedulesResponse>(scheduleData);

    // Create milestones in order
    for (let i = 0; i < validMilestones.length; i++) {
      const m = validMilestones[i];
      const milestoneData: Record<string, unknown> = {
        schedule: schedule.id,
        title: m.title.trim().slice(0, 200),
        orderIndex: i,
      };

      const mDate = toIsoDate(m.targetDate);
      if (mDate) milestoneData.targetDate = mDate;
      if (m.targetUnit && m.targetUnit.trim()) {
        milestoneData.targetUnit = m.targetUnit.trim().slice(0, 100);
      }

      await pb.collection("schedule_milestones").create(milestoneData);
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { id: schedule.id } };
  } catch (err: unknown) {
    const diag = logDiagnostic(err, { action: "createGroupSchedule", groupId, input });
    const userMsg = extractErrorMessage(err, "Program kaydedilirken bir hata oluştu.");
    return { success: false, error: userMsg, traceId: diag.traceId };
  }
}

export async function updateGroupScheduleStatus(
  scheduleId: string,
  groupId: string,
  status: GroupSchedulesStatusOptions,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isOwner && !session.isAdmin) {
    return { success: false, error: "Sadece çember yöneticisi program durumunu güncelleyebilir." };
  }

  try {
    await requireScheduleInGroup(scheduleId, groupId);
    const pb = await getSuperuserClient();
    await pb.collection("group_schedules").update(scheduleId, { status });
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "updateGroupScheduleStatus", scheduleId, groupId, status });
    return { success: false, error: "Durum güncellenemedi.", traceId: diag.traceId };
  }
}

export async function deleteGroupSchedule(
  scheduleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isOwner && !session.isAdmin) {
    return { success: false, error: "Sadece çember yöneticisi programı silebilir." };
  }

  try {
    await requireScheduleInGroup(scheduleId, groupId);
    const pb = await getSuperuserClient();
    await pb.collection("group_schedules").delete(scheduleId);
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteGroupSchedule", scheduleId, groupId });
    return { success: false, error: "Program silinemedi.", traceId: diag.traceId };
  }
}

export async function toggleMilestoneCheckin(
  milestoneId: string,
  groupId: string,
): Promise<ActionResult<{ checkedIn: boolean }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    await requireMembership(groupId, session.id);
    await requireMilestoneInGroup(milestoneId, groupId);
    const pb = await getSuperuserClient();

    const existing = await pb
      .collection("milestone_checkins")
      .getFirstListItem<MilestoneCheckinsResponse>(
        pb.filter("milestone = {:milestoneId} && user = {:userId}", {
          milestoneId,
          userId: session.id,
        }),
      )
      .catch(() => null);

    if (existing) {
      await pb.collection("milestone_checkins").delete(existing.id);
      revalidatePath(`/groups/${groupId}`);
      return { success: true, data: { checkedIn: false } };
    } else {
      await pb.collection("milestone_checkins").create({
        milestone: milestoneId,
        user: session.id,
      });
      revalidatePath(`/groups/${groupId}`);
      return { success: true, data: { checkedIn: true } };
    }
  } catch (err) {
    const diag = logDiagnostic(err, { action: "toggleMilestoneCheckin", milestoneId, groupId });
    return { success: false, error: "Kontrol noktası güncellenemedi.", traceId: diag.traceId };
  }
}

export function filterMilestoneCommentsForViewer(
  records: MilestoneCommentsResponse<{ user?: UsersResponse }>[],
  hasCheckedIn: boolean,
): MilestoneCommentsResult {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return {
      comments: [],
      isLocked: !hasCheckedIn,
      lockedCount: 0,
      hasCheckedIn,
    };
  }

  if (!hasCheckedIn) {
    // Redact comment bodies to protect user from spoilers before checkin
    const redactedComments: MilestoneCommentItem[] = records.map((c) => ({
      id: c.id,
      milestone: c.milestone,
      user: c.user,
      group: c.group,
      isSpoiler: c.isSpoiler,
      createdAt: c.createdAt,
      isLocked: true,
      author: c.expand?.user
        ? {
            id: c.expand.user.id,
            name: c.expand.user.name,
            avatarUrl: c.expand.user.avatarUrl,
          }
        : undefined,
    }));

    return {
      comments: redactedComments,
      isLocked: true,
      lockedCount: records.length,
      hasCheckedIn: false,
    };
  }

  const fullComments: MilestoneCommentItem[] = records.map((c) => ({
    id: c.id,
    milestone: c.milestone,
    user: c.user,
    group: c.group,
    content: c.content,
    isSpoiler: c.isSpoiler,
    createdAt: c.createdAt,
    isLocked: false,
    author: c.expand?.user
      ? {
          id: c.expand.user.id,
          name: c.expand.user.name,
          email: c.expand.user.email,
          avatarUrl: c.expand.user.avatarUrl,
        }
      : undefined,
  }));

  return {
    comments: fullComments,
    isLocked: false,
    lockedCount: 0,
    hasCheckedIn: true,
  };
}

export async function getMilestoneComments(
  milestoneId: string,
  groupId: string,
): Promise<ActionResult<MilestoneCommentsResult>> {
  const session = await getSession();
  try {
    const access = await resolveCircleAccess(groupId, session?.id);
    if (!access.isMember && !access.group.isPublic) {
      return { success: false, error: "Bu çembere erişim yetkiniz bulunmuyor." };
    }

    await requireMilestoneInGroup(milestoneId, groupId);
    const pb = await getSuperuserClient();

    let hasCheckedIn = false;
    if (session?.id) {
      const checkin = await pb
        .collection("milestone_checkins")
        .getFirstListItem<MilestoneCheckinsResponse>(
          pb.filter("milestone = {:milestoneId} && user = {:userId}", {
            milestoneId,
            userId: session.id,
          }),
        )
        .catch(() => null);
      hasCheckedIn = Boolean(checkin);
    }

    const records = await pb
      .collection("milestone_comments")
      .getFullList<MilestoneCommentsResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("milestone = {:milestoneId}", { milestoneId }),
        expand: "user",
        sort: "createdAt",
      });

    return {
      success: true,
      data: filterMilestoneCommentsForViewer(records, hasCheckedIn),
    };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "getMilestoneComments", milestoneId, groupId });
    return {
      success: false,
      error: "Aşama yorumları yüklenemedi.",
      traceId: diag.traceId,
    };
  }
}

export async function addMilestoneComment(
  milestoneId: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult<MilestoneCommentItem>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  const rawContent = String(formData.get("content") ?? "").trim();
  if (!rawContent) {
    return { success: false, error: "Yorum içeriği boş olamaz." };
  }
  if (rawContent.length > 2000) {
    return { success: false, error: "Yorum 2000 karakterden uzun olamaz." };
  }

  const isSpoiler =
    formData.get("isSpoiler") === "true" ||
    formData.get("isSpoiler") === "on" ||
    formData.get("isSpoiler") === "1";

  try {
    await requireMembership(groupId, session.id);
    await requireMilestoneInGroup(milestoneId, groupId);
    const pb = await getSuperuserClient();

    const record = await pb
      .collection("milestone_comments")
      .create<MilestoneCommentsResponse<{ user?: UsersResponse }>>({
        milestone: milestoneId,
        user: session.id,
        group: groupId,
        content: rawContent,
        isSpoiler,
      }, {
        expand: "user",
      });

    const author =
      record.expand?.user ??
      (await pb.collection("users").getOne<UsersResponse>(session.id).catch(() => undefined));

    revalidatePath(`/groups/${groupId}`);
    return {
      success: true,
      data: {
        id: record.id,
        milestone: record.milestone,
        user: record.user,
        group: record.group,
        content: record.content,
        isSpoiler: record.isSpoiler,
        createdAt: record.createdAt,
        isLocked: false,
        author: author
          ? {
              id: author.id,
              name: author.name,
              email: author.email,
              avatarUrl: author.avatarUrl,
            }
          : undefined,
      },
    };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addMilestoneComment", milestoneId, groupId });
    return {
      success: false,
      error: "Yorum eklenirken bir hata oluştu.",
      traceId: diag.traceId,
    };
  }
}

export async function deleteMilestoneComment(
  commentId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    const pb = await getSuperuserClient();
    const comment = await pb
      .collection("milestone_comments")
      .getOne<MilestoneCommentsResponse>(commentId);

    if (comment.group !== groupId) {
      return { success: false, error: "Yorum bu çembere ait değil." };
    }

    const isOwn = comment.user === session.id;
    if (!isOwn && !access.isOwner && !session.isAdmin) {
      return { success: false, error: "Bu yorumu silme yetkiniz bulunmuyor." };
    }

    await pb.collection("milestone_comments").delete(commentId);
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteMilestoneComment", commentId, groupId });
    return {
      success: false,
      error: "Yorum silinemedi.",
      traceId: diag.traceId,
    };
  }
}
