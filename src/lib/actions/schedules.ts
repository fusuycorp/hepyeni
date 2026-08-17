"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireOwner, resolveCircleAccess } from "@/lib/membership";
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
    console.error("[getGroupSchedules Error]:", err);
    return [];
  }
}

export async function createGroupSchedule(
  groupId: string,
  input: CreateGroupScheduleInput,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Require owner or admin
  await requireOwner(groupId, session.id);

  const pb = await getSuperuserClient();

  const scheduleData: Partial<GroupSchedulesRecord> = {
    group: groupId,
    title: input.titleId || undefined,
    name: input.name.trim().slice(0, 200),
    description: input.description ? input.description.trim().slice(0, 1000) : undefined,
    startDate: input.startDate || undefined,
    targetDate: input.targetDate || undefined,
    status: "active",
    createdBy: session.id,
  };

  const schedule = await pb
    .collection("group_schedules")
    .create<GroupSchedulesResponse>(scheduleData);

  // Create milestones in order
  for (let i = 0; i < input.milestones.length; i++) {
    const m = input.milestones[i];
    if (!m.title.trim()) continue;

    const milestoneData: Partial<ScheduleMilestonesRecord> = {
      schedule: schedule.id,
      title: m.title.trim().slice(0, 200),
      targetDate: m.targetDate || undefined,
      targetUnit: m.targetUnit ? m.targetUnit.trim().slice(0, 100) : undefined,
      orderIndex: i,
    };

    await pb.collection("schedule_milestones").create(milestoneData);
  }

  revalidatePath(`/groups/${groupId}`);
  return schedule;
}

export async function updateGroupScheduleStatus(
  scheduleId: string,
  groupId: string,
  status: GroupSchedulesStatusOptions,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  await requireOwner(groupId, session.id);
  const pb = await getSuperuserClient();

  await pb.collection("group_schedules").update(scheduleId, { status });
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroupSchedule(scheduleId: string, groupId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  await requireOwner(groupId, session.id);
  const pb = await getSuperuserClient();

  await pb.collection("group_schedules").delete(scheduleId);
  revalidatePath(`/groups/${groupId}`);
}

export async function toggleMilestoneCheckin(
  milestoneId: string,
  groupId: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await requireMembership(groupId, session.id);
  const pb = await getSuperuserClient();

  // Check if checkin already exists
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
  } else {
    await pb.collection("milestone_checkins").create({
      milestone: milestoneId,
      user: session.id,
    });
  }

  revalidatePath(`/groups/${groupId}`);
}
