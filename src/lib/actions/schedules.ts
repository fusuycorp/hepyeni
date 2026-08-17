"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, resolveCircleAccess } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type {
  GroupSchedulesRecord,
  GroupSchedulesResponse,
  GroupSchedulesStatusOptions,
  MilestoneCheckinsResponse,
  ScheduleMilestonesRecord,
  ScheduleMilestonesResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; traceId?: string; details?: Record<string, unknown> };

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
    if (milestoneIds.length > 0) {
      allCheckins = await pb
        .collection("milestone_checkins")
        .getFullList<MilestoneCheckinsResponse<{ user?: UsersResponse }>>({
          filter: milestoneIds.map((id) => `milestone = "${id}"`).join(" || "),
          expand: "user",
        });
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

    const milestonesBySchedule = new Map<string, MilestoneWithCheckins[]>();
    for (const m of allMilestones) {
      const checkins = checkinsByMilestone.get(m.id) || [];
      const hasCheckedIn = session?.id
        ? checkins.some((c) => c.user === session.id)
        : false;

      const list = milestonesBySchedule.get(m.schedule) || [];
      list.push({
        ...m,
        checkins,
        hasCheckedIn,
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
    scheduleData.title = input.titleId.trim();
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
