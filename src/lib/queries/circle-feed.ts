import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess, type CircleAccess } from "@/lib/membership";
import { getGroupSchedules } from "@/lib/queries/schedules";
import { getTitleCircleProgress } from "@/lib/queries/progress";
import { redactProposedTitles } from "@/lib/moods";
import { projectCommentRow, type PublicComment } from "@/lib/comments";
import {
  buildTitlePayload,
  categorizeCircleTitles,
  computeScoreAndUserVote,
  groupTitleQuery,
  mapGroupReviewRow,
  type GroupReviewRow,
  type GroupTitleExpand,
  type LeanVoteRow,
  type MemberTitleProgress,
  type TitlePayload,
  type TitleWithProgress,
} from "@/lib/group-titles";
import type {
  CommentsResponse,
  GroupMembersResponse,
  GroupsResponse,
  ReviewsResponse,
  TitlesResponse,
  UserMediaProgressResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

type TitleExpand = {
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
};

export interface CircleFeedData {
  access: CircleAccess;
  group: GroupsResponse;
  members: GroupMembersResponse<{ user?: UsersResponse }>[];
  proposed: TitleWithProgress[];
  inProgress: TitleWithProgress[];
  consumed: TitleWithProgress[];
  /** Alias for proposed per ADR-015 */
  upNext: TitleWithProgress[];
  /** Alias for consumed per ADR-015 */
  finished: TitleWithProgress[];
  commentCounts: Record<string, number>;
  schedules: Awaited<ReturnType<typeof getGroupSchedules>>;
  currentMember?: GroupMembersResponse<{ user?: UsersResponse }>;
  currentUserRole?: string;
  isOwnerOrAdmin: boolean;
}

export interface CircleTitleDetailData {
  access: CircleAccess;
  group: GroupsResponse;
  title: TitlePayload;
  comments: PublicComment[];
  memberProgress: Awaited<ReturnType<typeof getTitleCircleProgress>>;
  isOwnerOrAdmin: boolean;
}

/**
 * Deep query module: fetch the complete circle feed for a circle page.
 *
 * Encapsulates:
 * 1. Access resolution and guest permission gating.
 * 2. 8-way parallel PocketBase collection queries respecting ADR-017.
 * 3. Relation-of-relation in-memory joining for reviews and votes.
 * 4. PII stripping (emails never leave the server; R2 invariant).
 * 5. Review body isolation (only current member's own review body ships).
 * 6. Communal 3-section media lifecycle partitioning (ADR-015).
 * 7. Blind pick author identity redaction during active voting (ADR-012).
 */
export async function fetchCircleFeed(
  groupId: string,
  session?: Session | null,
): Promise<CircleFeedData> {
  const resolvedSession = session === undefined ? await getSession() : session;
  const access = await resolveCircleAccess(groupId, resolvedSession?.id);

  if (!access.isMember && !access.group.isPublic) {
    throw new Error("ACCESS_DENIED");
  }

  const group = access.group;
  const pb = await getSuperuserClient();

  const canViewReviews = access.canViewReviews;
  const needsTitles = access.canViewBacklog || access.canViewFinished;
  const titleQuery = groupTitleQuery(canViewReviews);

  const [
    members,
    groupTitles,
    commentRows,
    schedules,
    leanVoteRows,
    ownReviewRows,
    leanReviewRows,
    memberProgressRows,
  ] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      }),
    needsTitles
      ? pb.collection("titles").getFullList<TitlesResponse<TitleExpand>>({
          filter: pb.filter("group = {:groupId}", { groupId }),
          expand: titleQuery.expand,
          fields: titleQuery.fields,
          sort: "-createdAt",
        })
      : Promise.resolve([]),
    access.canViewComments
      ? pb.collection("comments").getFullList<CommentsResponse>({
          filter: pb.filter("group = {:groupId}", { groupId }),
          fields: "id,title",
        })
      : Promise.resolve([]),
    getGroupSchedules(groupId, resolvedSession, access),
    !canViewReviews && needsTitles
      ? pb.collection("votes").getFullList<LeanVoteRow>({
          filter: pb.filter("title.group = {:groupId}", { groupId }),
          fields: "value,title,user",
        })
      : Promise.resolve([]),
    canViewReviews && resolvedSession?.id && needsTitles
      ? pb.collection("reviews").getFullList<ReviewsResponse>({
          filter: pb.filter("user = {:userId} && title.group = {:groupId}", {
            userId: resolvedSession.id,
            groupId,
          }),
          fields: "id,title,reviewText",
        })
      : Promise.resolve([]),
    canViewReviews && needsTitles
      ? pb
          .collection("reviews")
          .getFullList<ReviewsResponse<{ user?: UsersResponse }>>({
            filter: pb.filter("title.group = {:groupId}", { groupId }),
            expand: "user",
            fields:
              "id,title,user,rating,createdAt," +
              "expand.user.id,expand.user.name,expand.user.avatarUrl",
          })
      : Promise.resolve([]),
    needsTitles
      ? pb
          .collection("user_media_progress")
          .getFullList<UserMediaProgressResponse>({
            filter: pb.filter(
              "groupTitle.group = {:groupId} && (status = 'in_progress' || status = 'completed')",
              { groupId },
            ),
            fields: "id,user,groupTitle,status,progressCurrent,progressTotal,progressUnit,updatedAt",
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const memberIds = members.map((m) => m.user);
  const memberProgressByTitle = new Map<string, MemberTitleProgress[]>();
  for (const p of memberProgressRows) {
    if (!p.groupTitle) continue;
    const list = memberProgressByTitle.get(p.groupTitle) ?? [];
    list.push({
      userId: p.user,
      status: p.status as "in_progress" | "completed",
      progressCurrent: p.progressCurrent,
      progressTotal: p.progressTotal,
      progressUnit: p.progressUnit,
      updatedAt: p.updatedAt,
    });
    memberProgressByTitle.set(p.groupTitle, list);
  }

  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.title] = (commentCounts[c.title] ?? 0) + 1;
  }

  const currentMember = resolvedSession?.id
    ? members.find((m) => m.user === resolvedSession.id)
    : undefined;
  const currentUserRole = currentMember?.role;

  const ownReviewTextByTitle = new Map<string, string>();
  for (const r of ownReviewRows) {
    if (r.reviewText && r.title) ownReviewTextByTitle.set(r.title, r.reviewText);
  }

  const leanVotesByTitle = new Map<string, LeanVoteRow[]>();
  for (const v of leanVoteRows) {
    const rows = leanVotesByTitle.get(v.title) ?? [];
    rows.push(v);
    leanVotesByTitle.set(v.title, rows);
  }

  const leanReviewsByTitle = new Map<
    string,
    ReviewsResponse<{ user?: UsersResponse }>[]
  >();
  for (const r of leanReviewRows) {
    const rows = leanReviewsByTitle.get(r.title) ?? [];
    rows.push(r);
    leanReviewsByTitle.set(r.title, rows);
  }

  const withScore = groupTitles.map((title) =>
    buildTitlePayload(title, {
      canViewReviews,
      currentUserId: resolvedSession?.id,
      leanVotesByTitle,
      leanReviewsByTitle,
      ownReviewTextByTitle,
    }),
  );

  const isOwnerOrAdmin = currentUserRole === "owner" || Boolean(resolvedSession?.isAdmin);

  const categorized = categorizeCircleTitles(
    withScore,
    memberProgressByTitle,
    memberIds,
    resolvedSession?.id,
  );

  const rawProposed = access.canViewBacklog
    ? categorized.proposed.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];

  const proposed = redactProposedTitles(
    rawProposed,
    group.isBlindPickEnabled,
    isOwnerOrAdmin,
  ) as TitleWithProgress[];

  const inProgress = access.canViewBacklog || access.canViewFinished
    ? (categorized.inProgress.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ) as TitleWithProgress[])
    : [];

  const consumed = access.canViewFinished
    ? (categorized.consumed.sort(
        (a, b) =>
          new Date(b.consumedAt || b.createdAt).getTime() -
          new Date(a.consumedAt || a.createdAt).getTime(),
      ) as TitleWithProgress[])
    : [];

  return {
    access,
    group,
    members,
    proposed,
    inProgress,
    consumed,
    upNext: proposed,
    finished: consumed,
    commentCounts,
    schedules,
    currentMember,
    currentUserRole,
    isOwnerOrAdmin,
  };
}

/**
 * Deep query module: fetch a single title's details within a circle.
 */
export async function fetchCircleTitleDetail(
  groupId: string,
  titleId: string,
  session?: Session | null,
): Promise<CircleTitleDetailData> {
  const resolvedSession = session === undefined ? await getSession() : session;
  const [access, titleInGroup] = await Promise.all([
    resolveCircleAccess(groupId, resolvedSession?.id),
    requireTitleInGroup(titleId, groupId),
  ]);

  if (!access.isMember && !access.group.isPublic) {
    throw new Error("ACCESS_DENIED");
  }

  const group = access.group;
  const pb = await getSuperuserClient();
  const titleQuery = groupTitleQuery(access.canViewReviews);

  const [titleRecord, leanReviewRows, ownReviewRows, comments, memberProgress] =
    await Promise.all([
      pb.collection("titles").getOne<TitlesResponse<GroupTitleExpand>>(titleId, {
        expand: titleQuery.expand,
        fields: titleQuery.fields,
      }),
      access.canViewReviews
        ? pb
            .collection("reviews")
            .getFullList<ReviewsResponse<{ user?: UsersResponse }>>({
              filter: pb.filter("title = {:titleId}", { titleId }),
              sort: "-createdAt",
              expand: "user",
              fields:
                "id,title,user,rating,createdAt," +
                "expand.user.id,expand.user.name,expand.user.avatarUrl",
            })
        : Promise.resolve([]),
      access.canViewReviews && resolvedSession?.id
        ? pb.collection("reviews").getFullList<ReviewsResponse>({
            filter: pb.filter("user = {:userId} && title = {:titleId}", {
              userId: resolvedSession.id,
              titleId,
            }),
            fields: "id,title,reviewText",
          })
        : Promise.resolve([]),
      access.canViewComments
        ? pb
            .collection("comments")
            .getFullList<CommentsResponse<{ user?: UsersResponse }>>({
              filter: pb.filter("title = {:titleId} && group = {:groupId}", {
                titleId,
                groupId,
              }),
              expand: "user",
              sort: "createdAt",
              fields:
                "id,title,user,group,content,parentId,createdAt," +
                "expand.user.id,expand.user.name,expand.user.avatarUrl",
            })
        : Promise.resolve([]),
      getTitleCircleProgress(titleId, titleInGroup, groupId, resolvedSession, access),
    ]);

  if (titleRecord.group !== groupId) {
    throw new Error("TITLE_NOT_IN_GROUP");
  }

  const ownReviewTextByTitle = new Map<string, string>();
  for (const r of ownReviewRows) {
    if (r.reviewText && r.title) ownReviewTextByTitle.set(r.title, r.reviewText);
  }
  const reviewRows: GroupReviewRow[] = leanReviewRows.map((r) =>
    mapGroupReviewRow(r, resolvedSession?.id, ownReviewTextByTitle),
  );

  const votes = titleRecord.expand?.votes_via_title ?? [];
  const { score, userVote } = computeScoreAndUserVote(votes, resolvedSession?.id);
  const isOwnerOrAdmin = access.isOwner || Boolean(resolvedSession?.isAdmin);

  const withReviews: TitlesResponse<GroupTitleExpand> = {
    ...titleRecord,
    expand: { ...titleRecord.expand, reviews_via_title: reviewRows },
  };

  const [redactedTitle] = redactProposedTitles(
    [withReviews],
    group.isBlindPickEnabled,
    isOwnerOrAdmin,
  );

  const title: TitlePayload = {
    ...redactedTitle,
    score,
    userVote,
  };

  const projectedComments: PublicComment[] = comments.map(projectCommentRow);

  return {
    access,
    group,
    title,
    comments: projectedComments,
    memberProgress,
    isOwnerOrAdmin,
  };
}
