import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { resolveCircleAccess, type CircleAccess } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";
import { redactProposedTitles } from "@/lib/moods";
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
  creator?: PublicUser;
  milestones: MilestoneWithCheckins[];
}

function canViewerReadSchedules(resolvedAccess: CircleAccess): boolean {
  if (!resolvedAccess.isMember && !resolvedAccess.group.isPublic) {
    return false;
  }
  return !(
    !resolvedAccess.isMember &&
    resolvedAccess.canViewBacklog === false &&
    resolvedAccess.canViewFinished === false
  );
}

async function fetchMilestoneActivity(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  milestoneIds: string[],
): Promise<{
  allCheckins: MilestoneCheckinsResponse<{ user?: PublicUser }>[];
  allComments: MilestoneCommentsResponse[];
}> {
  if (milestoneIds.length === 0) {
    return { allCheckins: [], allComments: [] };
  }
  const milestoneFilter = milestoneIds
    .map((id) => pb.filter("milestone = {:id}", { id }))
    .join(" || ");
  const [checkinsRes, commentsRes] = await Promise.all([
    pb
      .collection("milestone_checkins")
      .getFullList<MilestoneCheckinsResponse<{ user?: UsersResponse }>>({
        filter: milestoneFilter,
        expand: "user",
        // R2: trim the expanded voter to id/name/avatarUrl on the wire.
        fields:
          "id,milestone,user,createdAt," +
          "expand.user.id,expand.user.name,expand.user.avatarUrl",
      }),
    // P6: only the milestone id is needed for the comment tally
    pb
      .collection("milestone_comments")
      .getFullList<MilestoneCommentsResponse>({
        filter: milestoneFilter,
        fields: "id,milestone",
      }),
  ]);
  const allCheckins = checkinsRes.map((c) => {
    const user = pickReviewerUser(c.expand?.user);
    return { ...c, expand: user ? { user } : {} };
  });
  return { allCheckins, allComments: commentsRes };
}

function buildMilestonesByScheduleMap(
  allMilestones: ScheduleMilestonesResponse[],
  allCheckins: MilestoneCheckinsResponse<{ user?: PublicUser }>[],
  allComments: MilestoneCommentsResponse[],
  currentUserId?: string,
): Map<string, MilestoneWithCheckins[]> {
  const checkinsByMilestone = new Map<
    string,
    MilestoneCheckinsResponse<{ user?: PublicUser }>[]
  >();
  for (const c of allCheckins) {
    const list = checkinsByMilestone.get(c.milestone) ?? [];
    list.push(c);
    checkinsByMilestone.set(c.milestone, list);
  }

  const commentCountsByMilestone = new Map<string, number>();
  for (const comment of allComments) {
    const count = commentCountsByMilestone.get(comment.milestone) ?? 0;
    commentCountsByMilestone.set(comment.milestone, count + 1);
  }

  const milestonesBySchedule = new Map<string, MilestoneWithCheckins[]>();
  for (const m of allMilestones) {
    const checkins = checkinsByMilestone.get(m.id) ?? [];
    const hasCheckedIn = currentUserId
      ? checkins.some((c) => c.user === currentUserId)
      : false;
    const commentCount = commentCountsByMilestone.get(m.id) ?? 0;

    const list = milestonesBySchedule.get(m.schedule) ?? [];
    list.push({ ...m, checkins, hasCheckedIn, commentCount });
    milestonesBySchedule.set(m.schedule, list);
  }
  return milestonesBySchedule;
}

export async function getGroupSchedules(
  groupId: string,
  session?: Session | null,
  access?: CircleAccess | null,
): Promise<GroupScheduleWithMilestones[]> {
  // P2: accept already-resolved session/access from the caller to avoid a
  // second getSession()/resolveCircleAccess round trip on the group page.
  const resolvedSession = session === undefined ? await getSession() : session;
  const resolvedAccess =
    access ?? (await resolveCircleAccess(groupId, resolvedSession?.id));
  if (!canViewerReadSchedules(resolvedAccess)) {
    return [];
  }

  try {
    const pb = await getSuperuserClient();

    const schedules = await pb
      .collection("group_schedules")
      .getFullList<
        GroupSchedulesResponse<{
          title?: TitlesResponse;
          createdBy?: UsersResponse;
        }>
      >({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "title,createdBy",
        sort: "-createdAt",
      });

    if (schedules.length === 0) return [];

    // Fetch all milestones for these schedules (S7: bind each id, no raw concat)
    const allMilestones = await pb
      .collection("schedule_milestones")
      .getFullList<ScheduleMilestonesResponse>({
        filter: schedules
          .map((s) => pb.filter("schedule = {:id}", { id: s.id }))
          .join(" || "),
        sort: "orderIndex",
      });

    const { allCheckins, allComments } = await fetchMilestoneActivity(
      pb,
      allMilestones.map((m) => m.id),
    );
    const milestonesBySchedule = buildMilestonesByScheduleMap(
      allMilestones,
      allCheckins,
      allComments,
      resolvedSession?.id,
    );

    // R2 invariant: `creator` is projected, but the raw `expand` block must not
    // ride along on the returned object. Spreading the record (`...s`) would
    // re-introduce the full UsersResponse — email, emailVisibility, verified,
    // isAdmin — and this array is handed to the "use client"
    // GroupSchedulesCard, so anything left on it is serialised into the RSC
    // payload for every viewer of the circle, including public-circle guests.
    // Same shape as the checkin handling above.
    const isOwnerOrAdmin =
      resolvedAccess.isOwner || Boolean(resolvedSession?.isAdmin);
    return schedules.map(({ expand, ...schedule }) => ({
      ...schedule,
      titleRecord: expand?.title
        ? (redactProposedTitles(
            [expand.title as TitlesResponse<Record<string, unknown>>],
            resolvedAccess.group?.isBlindPickEnabled,
            isOwnerOrAdmin,
            resolvedSession?.id,
          )[0] as TitlesResponse)
        : undefined,
      creator: pickReviewerUser(expand?.createdBy),
      milestones: milestonesBySchedule.get(schedule.id) || [],
    }));
  } catch (err) {
    logDiagnostic(err, { action: "getGroupSchedules", groupId });
    return [];
  }
}
