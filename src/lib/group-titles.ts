import type {
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

// Client-bound payload shapes for the group page. The reviewer/voter "user"
// expansions are projected here (id/name/avatarUrl only) so an email or any
// other profile field can never leave the server, and review bodies are only
// ever attached to the current member's own review.

export type ReviewerUser = {
  id: string;
  name?: string;
  avatarUrl?: string;
};

// Same projection is used for every client-bound expanded user (comment
// authors, checkin voters, progress members) — email never ships.
export type PublicUser = ReviewerUser;

export type GroupReviewRow = {
  id: string;
  rating: number;
  title: string;
  user: string;
  createdAt: string;
  reviewText?: string;
  expand: { user?: ReviewerUser };
};

export type LeanVoteRow = {
  id: string;
  title: string;
  user: string;
  value: "up" | "down";
};

export type GroupTitleExpand = {
  addedBy?: ReviewerUser;
  votes_via_title?: LeanVoteRow[];
  reviews_via_title?: GroupReviewRow[];
};

export type TitlePayload = TitlesResponse<GroupTitleExpand> & {
  score: number;
  userVote?: "up" | "down";
};

// Wire-level query construction for the title list. When `!canViewReviews`,
// votes/reviews are dropped entirely (F-2) and the score/userVote scalars are
// computed server-side from a lean votes query — identity/ratings never ship.
//
// REVIEWS DO NOT RIDE THIS EXPAND. PocketBase 0.39 does not project nested
// relation-of-relation expand fields (`expand.reviews_via_title.user.*` comes
// back as a bare user id with no `.expand.user` — verified against a live
// instance). Reviews are fetched by the caller from the `reviews` collection
// with `expand=user` + a top-level field projection (which works) and attached
// per-title via `buildTitlePayload`'s `leanReviewsByTitle`.
export function groupTitleQuery(canViewReviews: boolean): {
  expand: string;
  fields: string;
} {
  const fields = [
    "id",
    "title",
    "creator",
    "mediaType",
    "coverUrl",
    "status",
    "createdAt",
    "addedBy",
    "metadata",
    "externalSource",
    "externalId",
    "expand.addedBy.id",
    "expand.addedBy.name",
    "expand.addedBy.avatarUrl",
  ];
  const expand = ["addedBy"];
  if (canViewReviews) {
    fields.push(
      "expand.votes_via_title.id",
      "expand.votes_via_title.title",
      "expand.votes_via_title.user",
      "expand.votes_via_title.value",
    );
    expand.push("votes_via_title");
  }
  return { expand: expand.join(","), fields: fields.join(",") };
}

export function computeScoreAndUserVote(
  votes: { title: string; value: "up" | "down"; user?: string }[] | undefined,
  currentUserId?: string,
): { score: number; userVote?: "up" | "down" } {
  const list = votes ?? [];
  const score = list.reduce((acc, v) => acc + (v.value === "up" ? 1 : -1), 0);
  const userVote = currentUserId
    ? list.find((v) => v.user === currentUserId)?.value
    : undefined;
  return { score, userVote };
}

export function pickReviewerUser(
  user?: UsersResponse | ReviewerUser | null,
): ReviewerUser | undefined {
  if (!user || typeof user !== "object") return undefined;
  const picked: ReviewerUser = { id: user.id };
  if (typeof user.name === "string" && user.name.trim()) picked.name = user.name;
  if (typeof user.avatarUrl === "string" && user.avatarUrl.trim()) {
    picked.avatarUrl = user.avatarUrl;
  }
  return picked;
}

// H1: keep `reviewText` on the current member's own review (ReviewForm prefill
// at group-content-view) and strip it from every other row. Own bodies are
// injected from a lean query so the wire never transfers 5KB review bodies.
export function mapGroupReviewRow(
  review: ReviewsResponse<{ user?: UsersResponse }>,
  currentUserId?: string,
  ownReviewTextByTitle?: Map<string, string>,
): GroupReviewRow {
  const isOwn = Boolean(currentUserId && review.user === currentUserId);
  const row: GroupReviewRow = {
    id: review.id,
    rating: review.rating,
    title: review.title,
    user: review.user,
    createdAt: review.createdAt,
    expand: {},
  };
  const user = pickReviewerUser(review.expand?.user);
  if (user) row.expand.user = user;
  if (isOwn) {
    const text = ownReviewTextByTitle?.get(review.title) ?? review.reviewText;
    if (text !== undefined) row.reviewText = text;
  }
  return row;
}

export function buildTitlePayload(
  title: TitlesResponse<{
    addedBy?: UsersResponse;
    votes_via_title?: VotesResponse[];
  }>,
  opts: {
    canViewReviews: boolean;
    currentUserId?: string;
    leanVotesByTitle?: Map<string, LeanVoteRow[]>;
    leanReviewsByTitle?: Map<string, ReviewsResponse<{ user?: UsersResponse }>[]>;
    ownReviewTextByTitle?: Map<string, string>;
  },
): TitlePayload {
  const addedBy = pickReviewerUser(title.expand?.addedBy);
  const expand: GroupTitleExpand = addedBy ? { addedBy } : {};

  if (opts.canViewReviews) {
    // reviews/expand.user are already projected on the wire by the caller's
    // lean reviews-collection query (expand=user + top-level fields); only own
    // bodies are injected from the separate light query.
    const reviews = opts.leanReviewsByTitle?.get(title.id) ?? [];
    expand.reviews_via_title = reviews.map((r) =>
      mapGroupReviewRow(r, opts.currentUserId, opts.ownReviewTextByTitle),
    );
    const votes = title.expand?.votes_via_title ?? [];
    expand.votes_via_title = votes.map((v) => ({
      id: v.id,
      title: v.title,
      user: v.user,
      value: v.value,
    }));
    return {
      ...title,
      ...computeScoreAndUserVote(votes, opts.currentUserId),
      expand,
    };
  }

  const votes = opts.leanVotesByTitle?.get(title.id) ?? [];
  return {
    ...title,
    ...computeScoreAndUserVote(votes, opts.currentUserId),
    expand,
  };
}

export interface MemberTitleProgress {
  userId: string;
  status: "in_progress" | "completed";
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: string | null;
  updatedAt?: string;
}

export interface TitleProgressSummary {
  finishedCount: number;
  inProgressCount: number;
  totalMembers: number;
  allMembersFinished: boolean;
  currentUserStatus: "not_started" | "in_progress" | "completed";
}

export type TitleWithProgress = TitlePayload & {
  progressSummary: TitleProgressSummary;
};

export function categorizeCircleTitles(
  titles: TitlePayload[],
  memberProgressByTitle: Map<string, MemberTitleProgress[]>,
  activeMemberIds: string[],
  currentUserId?: string,
): {
  proposed: TitleWithProgress[];
  inProgress: TitleWithProgress[];
  consumed: TitleWithProgress[];
} {
  const memberSet = new Set(activeMemberIds);
  const totalMembers = activeMemberIds.length;

  const proposed: TitleWithProgress[] = [];
  const inProgress: TitleWithProgress[] = [];
  const consumed: TitleWithProgress[] = [];

  for (const title of titles) {
    const rawList = memberProgressByTitle.get(title.id) ?? [];
    // Only count active members in this circle
    const activeProgress = rawList.filter((p) => memberSet.has(p.userId));

    let finishedCount = 0;
    let inProgressCount = 0;
    let currentUserStatus: "not_started" | "in_progress" | "completed" = "not_started";

    for (const p of activeProgress) {
      if (p.status === "completed") {
        finishedCount++;
      } else if (p.status === "in_progress") {
        inProgressCount++;
      }
      if (currentUserId && p.userId === currentUserId) {
        currentUserStatus = p.status;
      }
    }

    const allMembersFinished =
      title.status === "consumed" ||
      (totalMembers > 0 && finishedCount >= totalMembers);

    const progressSummary: TitleProgressSummary = {
      finishedCount,
      inProgressCount,
      totalMembers,
      allMembersFinished,
      currentUserStatus,
    };

    const titleWithProgress: TitleWithProgress = {
      ...title,
      progressSummary,
    };

    if (allMembersFinished) {
      consumed.push(titleWithProgress);
    } else if (inProgressCount > 0 || finishedCount > 0) {
      inProgress.push(titleWithProgress);
    } else {
      proposed.push(titleWithProgress);
    }
  }

  return { proposed, inProgress, consumed };
}