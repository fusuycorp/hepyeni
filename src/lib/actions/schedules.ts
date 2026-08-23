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
import { extractErrorMessage, logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type { Session } from "@/lib/pocketbase/session";
import type { CircleAccess } from "@/lib/membership";
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
import { toIsoDate } from "@/lib/date";
import {
  filterMilestoneCommentsForViewer,
  type MilestoneCommentItem,
  type MilestoneCommentsResult,
} from "@/lib/schedules";
import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";

export type { ActionResult };
export type { MilestoneCommentItem, MilestoneCommentsResult } from "@/lib/schedules";

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
  // R2: checkin voters are projected to id/name/avatarUrl before shipping.
  checkins: MilestoneCheckinsResponse<{ user?: PublicUser }>[];
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
  session?: Session | null,
  access?: CircleAccess | null,
): Promise<GroupScheduleWithMilestones[]> {
  // P2: accept already-resolved session/access from the caller to avoid a
  // second getSession()/resolveCircleAccess round trip on the group page.
  const resolvedSession = session ?? (await getSession());
  const resolvedAccess =
    access ?? (await resolveCircleAccess(groupId, resolvedSession?.id));
  if (!resolvedAccess.isMember && !resolvedAccess.group.isPublic) {
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

    // Fetch all milestones for these schedules (S7: bind each id, no raw concat)
    const allMilestones = await pb
      .collection("schedule_milestones")
      .getFullList<ScheduleMilestonesResponse>({
        filter: scheduleIds
          .map((id) => pb.filter("schedule = {:id}", { id }))
          .join(" || "),
        sort: "orderIndex",
      });

    const milestoneIds = allMilestones.map((m) => m.id);

    // Fetch all checkins for these milestones
    let allCheckins: MilestoneCheckinsResponse<{ user?: PublicUser }>[] = [];
    let allComments: MilestoneCommentsResponse[] = [];
    if (milestoneIds.length > 0) {
      const milestoneFilter = milestoneIds
        .map((id) => pb.filter("milestone = {:id}", { id }))
        .join(" || ");
      const [checkinsRes, commentsRes] = await Promise.all([
        pb.collection("milestone_checkins").getFullList<MilestoneCheckinsResponse<{ user?: UsersResponse }>>({
          filter: milestoneFilter,
          expand: "user",
          // R2: trim the expanded voter to id/name/avatarUrl on the wire.
          fields:
            "id,milestone,user,createdAt," +
            "expand.user.id,expand.user.name,expand.user.avatarUrl",
        }),
        // P6: only the milestone id is needed for the comment tally
        pb.collection("milestone_comments").getFullList<MilestoneCommentsResponse>({
          filter: milestoneFilter,
          fields: "id,milestone",
        }),
      ]);
      allCheckins = checkinsRes.map((c) => {
        const user = pickReviewerUser(c.expand?.user);
        return { ...c, expand: user ? { user } : {} };
      });
      allComments = commentsRes;
    }

    const checkinsByMilestone = new Map<
      string,
      MilestoneCheckinsResponse<{ user?: PublicUser }>[]
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
      const hasCheckedIn = resolvedSession?.id
        ? checkins.some((c) => c.user === resolvedSession.id)
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
    return { success: false, error: "Please sign in first." };
  }

  // Require circle membership or admin
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isMember && !session.isAdmin) {
    return { success: false, error: "You do not have permission to create schedules in this circle." };
  }

  const cleanName = input.name?.trim();
  if (!cleanName) {
    return { success: false, error: "Please provide a schedule name." };
  }

  const validMilestones = (input.milestones || []).filter((m) => m.title && m.title.trim().length > 0);
  if (validMilestones.length === 0) {
    return { success: false, error: "Add at least one valid milestone." };
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
      return { success: false, error: "The selected media does not belong to this circle." };
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

    // P4: create milestones in parallel — orderIndex is stored explicitly, so
    // concurrent writes cannot reorder.
    // ponytail: non-transactional ceiling — a mid-batch milestone write failure
    // leaves an orphan schedule with only some milestones. Upgrade path: wrap
    // schedule+milestones in a PB transaction or `group_schedules.update` after
    // the batch (upsert path); PocketBase 0.23+ has no multi-collection
    // transaction today.
    const milestoneWrites = validMilestones.map(async (m, i) => {
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
    });
    await Promise.all(milestoneWrites);

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
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isOwner && !session.isAdmin) {
    return { success: false, error: "Only a circle owner can update the schedule status." };
  }

  try {
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
  const access = await resolveCircleAccess(groupId, session.id);
  if (!access.isOwner && !session.isAdmin) {
    return { success: false, error: "Only a circle owner can delete the schedule." };
  }

  try {
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
