"use server";

import { revalidatePath } from "next/cache";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  requireMembership,
  requireMilestoneInGroup,
  requireScheduleInGroup,
  requireTitleInGroup,
  resolveCircleAccess,
} from "@/lib/membership";
import { pickReviewerUser } from "@/lib/group-titles";
import { extractErrorMessage, logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type {
  GroupSchedulesResponse,
  GroupSchedulesStatusOptions,
  MilestoneCheckinsResponse,
  MilestoneCommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";
import { toIsoDate } from "@/lib/date";
import {
  filterMilestoneCommentsForViewer,
  type MilestoneCommentItem,
  type MilestoneCommentsResult,
} from "@/lib/schedules";

import {
  getGroupSchedules as getGroupSchedulesQuery,
  type MilestoneWithCheckins,
  type GroupScheduleWithMilestones,
} from "@/lib/queries/schedules";

export type { ActionResult };
export type { MilestoneCommentItem, MilestoneCommentsResult } from "@/lib/schedules";
export type { MilestoneWithCheckins, GroupScheduleWithMilestones };

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

export async function getGroupSchedules(
  groupId: string,
): Promise<GroupScheduleWithMilestones[]> {
  const session = await getSession();
  return getGroupSchedulesQuery(groupId, session);
}

function buildGroupSchedulePayload(
  groupId: string,
  userId: string,
  cleanName: string,
  input: CreateGroupScheduleInput,
  verifiedTitleId?: string,
): Record<string, unknown> {
  const scheduleData: Record<string, unknown> = {
    group: groupId,
    name: cleanName.slice(0, 200),
    description: input.description ? input.description.trim().slice(0, 1000) : null,
    status: "active",
    createdBy: userId,
  };
  if (verifiedTitleId) scheduleData.title = verifiedTitleId;
  const parsedStartDate = toIsoDate(input.startDate);
  if (parsedStartDate) scheduleData.startDate = parsedStartDate;
  const parsedTargetDate = toIsoDate(input.targetDate);
  if (parsedTargetDate) scheduleData.targetDate = parsedTargetDate;
  return scheduleData;
}

function buildMilestoneCreatePayload(
  scheduleId: string,
  m: CreateScheduleMilestoneInput,
  orderIndex: number,
): Record<string, unknown> {
  const milestoneData: Record<string, unknown> = {
    schedule: scheduleId,
    title: m.title.trim().slice(0, 200),
    orderIndex,
  };
  const mDate = toIsoDate(m.targetDate);
  if (mDate) milestoneData.targetDate = mDate;
  const trimmedUnit = m.targetUnit?.trim();
  if (trimmedUnit) milestoneData.targetUnit = trimmedUnit.slice(0, 100);
  return milestoneData;
}

async function resolveOptionalScheduleTitleId(
  rawTitleId: string | undefined,
  groupId: string,
): Promise<{ ok: true; titleId?: string } | { ok: false; error: string }> {
  const trimmed = rawTitleId?.trim();
  if (!trimmed) return { ok: true };
  try {
    await requireTitleInGroup(trimmed, groupId);
    return { ok: true, titleId: trimmed };
  } catch {
    return { ok: false, error: "The selected media does not belong to this circle." };
  }
}

function validateScheduleInput(input: CreateGroupScheduleInput):
  | { ok: true; cleanName: string; validMilestones: CreateScheduleMilestoneInput[] }
  | { ok: false; error: string } {
  const validMilestones = (input.milestones || []).filter((m) => Boolean(m.title?.trim()));
  if (validMilestones.length === 0) {
    return { ok: false, error: "Add at least one valid milestone." };
  }
  if (validMilestones.length > 50) {
    return { ok: false, error: "A schedule can have at most 50 milestones." };
  }
  const cleanName = input.name?.trim();
  if (!cleanName) {
    return { ok: false, error: "Please provide a schedule name." };
  }
  return { ok: true, cleanName, validMilestones };
}

export async function createGroupSchedule(
  groupId: string,
  input: CreateGroupScheduleInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in first." };

  const validation = validateScheduleInput(input);
  if (!validation.ok) return { success: false, error: validation.error };
  const { cleanName, validMilestones } = validation;

  try {
    // Require circle membership or admin
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.isMember && !session.isAdmin) {
      return { success: false, error: "You do not have permission to create schedules in this circle." };
    }

    const titleCheck = await resolveOptionalScheduleTitleId(input.titleId, groupId);
    if (!titleCheck.ok) return { success: false, error: titleCheck.error };

    const pb = await getSuperuserClient();
    const schedule = await pb
      .collection("group_schedules")
      .create<GroupSchedulesResponse>(
        buildGroupSchedulePayload(groupId, session.id, cleanName, input, titleCheck.titleId),
      );

    // P4: create milestones in parallel — orderIndex is stored explicitly, so
    // concurrent writes cannot reorder.
    // ponytail: milestone creation batch <- non-transactional write leaves partial milestones on failure -> wrap in PocketBase transaction once multi-collection transactions are supported
    const results = await Promise.allSettled(
      validMilestones.map((m, i) =>
        pb
          .collection("schedule_milestones")
          .create(buildMilestoneCreatePayload(schedule.id, m, i)),
      ),
    );
    const failure = results.find(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failure) {
      await pb.collection("group_schedules").delete(schedule.id).catch(() => {});
      throw failure.reason;
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { id: schedule.id } };
  } catch (err: unknown) {
    // S2: log only non-sensitive keys, never the raw input payload
    const diag = logDiagnostic(err, {
      action: "createGroupSchedule",
      groupId,
      milestoneCount: validMilestones.length,
    });
    const userMsg = extractErrorMessage(
      err,
      "An error occurred while saving the schedule.",
    );
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
    return { success: false, error: "Please sign in first." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.isOwner && !session.isAdmin) {
      return { success: false, error: "Only a circle owner can update the schedule status." };
    }

    await requireScheduleInGroup(scheduleId, groupId);
    const pb = await getSuperuserClient();
    await pb.collection("group_schedules").update(scheduleId, { status });
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "updateGroupScheduleStatus", scheduleId, groupId, status });
    return { success: false, error: "Unable to update the status.", traceId: diag.traceId };
  }
}

export async function deleteGroupSchedule(
  scheduleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.isOwner && !session.isAdmin) {
      return { success: false, error: "Only a circle owner can delete the schedule." };
    }

    await requireScheduleInGroup(scheduleId, groupId);
    const pb = await getSuperuserClient();
    await pb.collection("group_schedules").delete(scheduleId);
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteGroupSchedule", scheduleId, groupId });
    return { success: false, error: "Unable to delete the schedule.", traceId: diag.traceId };
  }
}

async function deleteCheckinIdempotent(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  checkinId: string,
): Promise<void> {
  try {
    await pb.collection("milestone_checkins").delete(checkinId);
  } catch (deleteErr) {
    if (!isNotFound(deleteErr)) throw deleteErr;
  }
}

async function createCheckinIdempotent(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  milestoneId: string,
  userId: string,
): Promise<void> {
  try {
    await pb.collection("milestone_checkins").create({
      milestone: milestoneId,
      user: userId,
    });
  } catch (createErr) {
    if (!isValidationNotUnique(createErr)) throw createErr;
  }
}

export async function toggleMilestoneCheckin(
  milestoneId: string,
  groupId: string,
): Promise<ActionResult<{ checkedIn: boolean }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
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
      await deleteCheckinIdempotent(pb, existing.id);
    } else {
      await createCheckinIdempotent(pb, milestoneId, session.id);
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { checkedIn: !existing } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "toggleMilestoneCheckin", milestoneId, groupId });
    return { success: false, error: "Unable to update the check-in.", traceId: diag.traceId };
  }
}



export async function getMilestoneComments(
  milestoneId: string,
  groupId: string,
): Promise<ActionResult<MilestoneCommentsResult>> {
  const session = await getSession();
  try {
    const access = await resolveCircleAccess(groupId, session?.id);
    if (!access.isMember && !access.group.isPublic) {
      return { success: false, error: "You do not have access to this circle." };
    }
    if (!access.canViewComments) {
      return {
        success: true,
        data: { comments: [], hasCheckedIn: false, isLocked: true, lockedCount: 0 },
      };
    }

    await requireMilestoneInGroup(milestoneId, groupId);
    const pb = await getSuperuserClient();

    let hasCheckedIn = false;
    if (session?.id && access.isMember) {
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
      error: "Unable to load milestone comments.",
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
    return { success: false, error: "Please sign in first." };
  }

  const rawContent = String(formData.get("content") ?? "").trim();
  if (!rawContent) {
    return { success: false, error: "Comment content cannot be empty." };
  }
  if (rawContent.length > 2000) {
    return { success: false, error: "Comment cannot be longer than 2000 characters." };
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

    const author = pickReviewerUser(
      record.expand?.user ??
        (await pb
          .collection("users")
          .getOne<UsersResponse>(session.id)
          .catch(() => undefined)),
    );

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
        author,
      },
    };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addMilestoneComment", milestoneId, groupId });
    return {
      success: false,
      error: "An error occurred while adding the comment.",
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
    return { success: false, error: "Please sign in first." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    const pb = await getSuperuserClient();
    const comment = await pb
      .collection("milestone_comments")
      .getOne<MilestoneCommentsResponse>(commentId);

    if (comment.group !== groupId) {
      return { success: false, error: "This comment does not belong to this circle." };
    }

    const isOwn = comment.user === session.id;
    if (!isOwn && !access.isOwner && !session.isAdmin) {
      return { success: false, error: "You do not have permission to delete this comment." };
    }

    await pb.collection("milestone_comments").delete(commentId);
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteMilestoneComment", commentId, groupId });
    return {
      success: false,
      error: "Unable to delete the comment.",
      traceId: diag.traceId,
    };
  }
}
