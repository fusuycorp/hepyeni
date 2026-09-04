import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  resolveCircleAccess,
  type CircleAccess,
} from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";
import type {
  GroupSchedulesResponse,
  MilestoneCheckinsResponse,
  MilestoneCommentsResponse,
  ScheduleMilestonesResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

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
