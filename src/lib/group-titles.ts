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

export type GroupReviewRow = {
  id: string;
  rating: number;
  title: string;
  user: string;
  createdAt: string;
  collectionId: string;
  collectionName: string;
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
    "expand.addedBy.id",
    "expand.addedBy.name",
    "expand.addedBy.avatarUrl",
  ];
  if (canViewReviews) {
    fields.push(
      "expand.votes_via_title.id",
      "expand.votes_via_title.title",
      "expand.votes_via_title.user",
      "expand.votes_via_title.value",
      "expand.reviews_via_title.id",
      "expand.reviews_via_title.rating",
      "expand.reviews_via_title.title",
      "expand.reviews_via_title.user.id",
      "expand.reviews_via_title.user.name",
      "expand.reviews_via_title.user.avatarUrl",
      "expand.reviews_via_title.createdAt",
    );
    return {
      expand: "addedBy,votes_via_title,reviews_via_title.user",
      fields: fields.join(","),
    };
  }
  return { expand: "addedBy", fields: fields.join(",") };
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
    collectionId: review.collectionId,
    collectionName: review.collectionName,
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
    reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
  }>,
  opts: {
    canViewReviews: boolean;
    currentUserId?: string;
    leanVotesByTitle?: Map<string, LeanVoteRow[]>;
    ownReviewTextByTitle?: Map<string, string>;
  },
): TitlePayload {
  const addedBy = pickReviewerUser(title.expand?.addedBy);
  const expand: GroupTitleExpand = addedBy ? { addedBy } : {};

  if (opts.canViewReviews) {
    const reviews = title.expand?.reviews_via_title ?? [];
    const votes = title.expand?.votes_via_title ?? [];
    expand.reviews_via_title = reviews.map((r) =>
      mapGroupReviewRow(r, opts.currentUserId, opts.ownReviewTextByTitle),
    );
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