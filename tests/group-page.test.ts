import { describe, expect, it } from "bun:test";
import {
  buildTitlePayload,
  computeScoreAndUserVote,
  groupTitleQuery,
  mapGroupReviewRow,
  pickReviewerUser,
  type GroupReviewRow,
  type LeanVoteRow,
  type TitlePayload,
} from "@/lib/group-titles";
import { redactProposedTitles } from "@/lib/moods";
import type {
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

const UID_OWN = "usr_own";
const UID_OTHER = "usr_other";
const TITLE_ID = "ttl_1";

function reviewer(
  id: string,
  extra: Partial<UsersResponse> = {},
): UsersResponse {
  return {
    id,
    name: `User ${id.slice(4)}`,
    email: `${id}@example.com`,
    avatarUrl: `https://example.com/${id}.png`,
    verified: true,
    isAdmin: false,
    created: "2026-01-01T00:00:00.000Z" as any,
    updated: "2026-01-01T00:00:00.000Z" as any,
    ...extra,
  } as any;
}

function vote(
  id: string,
  byUserId: string,
  value: "up" | "down",
): VotesResponse {
  return {
    id,
    title: TITLE_ID,
    user: byUserId,
    value,
    createdAt: "2026-08-01T00:00:00.000Z" as any,
    collectionId: "col_votes",
    collectionName: "votes",
  };
}

function review(
  id: string,
  byUserId: string,
  rating: number,
  reviewText?: string,
): ReviewsResponse<{ user?: UsersResponse }> {
  return {
    id,
    rating,
    title: TITLE_ID,
    user: byUserId,
    reviewText,
    createdAt: "2026-08-01T00:00:00.000Z" as any,
    collectionId: "col_reviews",
    collectionName: "reviews",
    expand: { user: reviewer(byUserId) },
  } as ReviewsResponse<{ user?: UsersResponse }>;
}

function title(
  expand: {
    addedBy?: UsersResponse;
    votes_via_title?: VotesResponse[];
    reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
  } = {},
): TitlesResponse<{
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
}> {
  return {
    id: TITLE_ID,
    title: "Title One",
    creator: "Creator A",
    mediaType: "book",
    coverUrl: "https://example.com/cover.jpg",
    status: "consumed",
    createdAt: "2026-08-01T00:00:00.000Z" as any,
    addedBy: UID_OWN,
    group: "grp_1",
    externalId: "",
    externalSource: "",
    metadata: null,
    collectionId: "col_titles",
    collectionName: "titles",
    expand,
  } as any;
}

describe("Group page — wire-level query spec", () => {
  it("ships no votes/reviews expand when canViewReviews is false", () => {
    const q = groupTitleQuery(false);
    expect(q.expand).toBe("addedBy");
    expect(q.fields).not.toContain("reviews_");
    expect(q.fields).not.toContain("votes_");
    expect(q.fields).not.toContain("email");
  });

  it("expands votes/reviews only when canViewReviews is true, and never ships reviewText or user emails over the wire", () => {
    const q = groupTitleQuery(true);
    expect(q.expand).toContain("votes_via_title");
    expect(q.expand).toContain("reviews_via_title.user");
    expect(q.fields).toContain("expand.reviews_via_title.user.name");
    expect(q.fields).not.toContain("reviewText");
    expect(q.fields).not.toContain("email");
  });
});

describe("computeScoreAndUserVote", () => {
  const votes: LeanVoteRow[] = [
    { id: "v1", title: TITLE_ID, user: UID_OWN, value: "up" },
    { id: "v2", title: TITLE_ID, user: UID_OTHER, value: "down" },
    { id: "v3", title: "ttl_2", user: "usr_third", value: "up" },
  ];

  it("reduces up/down into a score", () => {
    expect(computeScoreAndUserVote(votes).score).toBe(1);
    expect(computeScoreAndUserVote([]).score).toBe(0);
    expect(computeScoreAndUserVote(undefined).score).toBe(0);
  });

  it("returns the current user's vote without leaking others'", () => {
    expect(computeScoreAndUserVote(votes, UID_OWN).userVote).toBe("up");
    expect(computeScoreAndUserVote(votes, "usr_ghost").userVote).toBeUndefined();
    expect(computeScoreAndUserVote(votes, undefined).userVote).toBeUndefined();
  });
});

describe("pickReviewerUser", () => {
  it("drops email and every non-{id,name,avatarUrl} field", () => {
    const picked = pickReviewerUser(reviewer(UID_OTHER))!;
    expect(picked).toEqual({
      id: UID_OTHER,
      name: "User other",
      avatarUrl: `https://example.com/${UID_OTHER}.png`,
    });
    expect(JSON.stringify(picked)).not.toContain("@");
    expect(JSON.stringify(picked)).not.toContain("email");
  });

  it("returns undefined for nullish input", () => {
    expect(pickReviewerUser(null)).toBeUndefined();
    expect(pickReviewerUser(undefined)).toBeUndefined();
  });
});

describe("mapGroupReviewRow", () => {
  it("keeps the current user's own reviewText, from the lean own-review query", () => {
    const ownTexts = new Map<string, string>([[TITLE_ID, "my body from lean query"]]);
    const row = mapGroupReviewRow(
      review("r_own", UID_OWN, 5),
      UID_OWN,
      ownTexts,
    );
    expect(row.reviewText).toBe("my body from lean query");
  });

  it("falls back to the row reviewText for the current user", () => {
    const row = mapGroupReviewRow(
      review("r_own2", UID_OWN, 4, "my inline body"),
      UID_OWN,
    );
    expect(row.reviewText).toBe("my inline body");
  });

  it("strips reviewText from other users' reviews even if the wire sent it", () => {
    const row = mapGroupReviewRow(review("r_other", UID_OTHER, 3, "secret body"));
    expect(row).not.toHaveProperty("reviewText");
  });

  it("projects the reviewer user to id/name/avatarUrl without email", () => {
    const row = mapGroupReviewRow(review("r_other2", UID_OTHER, 4));
    const user = row.expand?.user!;
    expect(user.id).toBe(UID_OTHER);
    expect(user).toHaveProperty("name");
    expect(user).not.toHaveProperty("email");
    expect(JSON.stringify(row)).not.toContain("@");
  });

  it("handles anonymous reviews (no expand.user)", () => {
    const anon = review("r_anon", UID_OTHER, 2);
    anon.expand = { user: undefined };
    const row = mapGroupReviewRow(anon, UID_OWN) as GroupReviewRow;
    expect(row.expand.user).toBeUndefined();
    expect(row.id).toBe("r_anon");
  });
});

describe("buildTitlePayload — canViewReviews = true", () => {
  const ownTexts = new Map<string, string>([[TITLE_ID, "own body"]]);
  const payload: TitlePayload = buildTitlePayload(
    title({
      addedBy: reviewer(UID_OTHER),
      votes_via_title: [
        vote("v1", UID_OWN, "up"),
        vote("v2", UID_OTHER, "down"),
      ],
      reviews_via_title: [
        review("r_own", UID_OWN, 5),
        review("r_other", UID_OTHER, 4, "leaked"),
      ],
    }),
    { canViewReviews: true, currentUserId: UID_OWN, ownReviewTextByTitle: ownTexts },
  );

  it("keeps the current user's reviewText and strips others'", () => {
    const [own, other] = payload.expand!.reviews_via_title!;
    expect(own.reviewText).toBe("own body");
    expect(other).not.toHaveProperty("reviewText");
  });

  it("computes score and userVote from the votes expand", () => {
    expect(payload.score).toBe(0);
    expect(payload.userVote).toBe("up");
  });

  it("projects votes to lean rows (user id only) and addedBy to public fields", () => {
    expect(payload.expand!.votes_via_title).toEqual([
      { id: "v1", title: TITLE_ID, user: UID_OWN, value: "up" },
      { id: "v2", title: TITLE_ID, user: UID_OTHER, value: "down" },
    ]);
    expect(payload.expand!.addedBy).toEqual({
      id: UID_OTHER,
      name: "User other",
      avatarUrl: `https://example.com/${UID_OTHER}.png`,
    });
  });

  it("never ships an email anywhere in the payload", () => {
    expect(JSON.stringify(payload)).not.toContain("@");
    expect(JSON.stringify(payload)).not.toContain("email");
  });
});

describe("buildTitlePayload — canViewReviews = false", () => {
  const leanVotesByTitle = new Map<string, LeanVoteRow[]>([
    [
      TITLE_ID,
      [
        { id: "v1", title: TITLE_ID, user: UID_OWN, value: "up" },
        { id: "v2", title: TITLE_ID, user: UID_OTHER, value: "down" },
        { id: "v3", title: TITLE_ID, user: "usr_third", value: "up" },
      ],
    ],
  ]);
  const payload = buildTitlePayload(title({ addedBy: reviewer(UID_OTHER) }), {
    canViewReviews: false,
    currentUserId: UID_OWN,
    leanVotesByTitle,
  });

  it("ships no votes/reviews expand at all", () => {
    expect(payload.expand).not.toHaveProperty("votes_via_title");
    expect(payload.expand).not.toHaveProperty("reviews_via_title");
    expect(Object.keys(payload.expand ?? {})).toEqual(["addedBy"]);
  });

  it("computes score and userVote from the lean votes query", () => {
    expect(payload.score).toBe(1);
    expect(payload.userVote).toBe("up");
  });

  it("never leaks reviewer/voter identity or emails", () => {
    const json = JSON.stringify(payload);
    expect(json).not.toContain("@");
    expect(json).not.toContain("email");
    expect(json).not.toContain("reviewText");
  });

  it("still projects the recommender (addedBy) to public fields", () => {
    expect(payload.expand!.addedBy).toEqual({
      id: UID_OTHER,
      name: "User other",
      avatarUrl: `https://example.com/${UID_OTHER}.png`,
    });
  });
});

describe("blind-pick interplay (regression guard)", () => {
  it("redactProposedTitles strips votes/reviews/votes from blind-picked titles without reintroducing emails", () => {
    const built: TitlePayload = buildTitlePayload(
      title({
        addedBy: reviewer(UID_OTHER),
        votes_via_title: [vote("v1", UID_OTHER, "up")],
        reviews_via_title: [review("r_other", UID_OTHER, 5, "secret")],
      }),
      { canViewReviews: true, currentUserId: UID_OWN, ownReviewTextByTitle: new Map() },
    );
    const [redacted] = redactProposedTitles(
      [{ ...built, status: "proposed" }],
      true,
      false,
    ) as TitlePayload[];
    expect(redacted.addedBy).toBe("");
    expect(redacted.expand).not.toHaveProperty("votes_via_title");
    expect(redacted.expand).not.toHaveProperty("reviews_via_title");
    expect(redacted.expand).not.toHaveProperty("addedBy");
    expect(JSON.stringify(redacted)).not.toContain("@");
    // score/userVote survive redaction (client still needs them for the vote UI)
    expect(redacted.score).toBe(1);
  });

  it("does not redact when blind pick is disabled", () => {
    const built: TitlePayload = buildTitlePayload(
      title({ reviews_via_title: [review("r_own", UID_OWN, 5)] }),
      { canViewReviews: true, currentUserId: UID_OWN, ownReviewTextByTitle: new Map([[TITLE_ID, "body"]]) },
    );
    const [kept] = redactProposedTitles(
      [{ ...built, status: "proposed" }],
      false,
      false,
    ) as TitlePayload[];
    expect(kept.addedBy).toBe(UID_OWN);
    expect(kept.expand!.reviews_via_title?.[0].reviewText).toBe("body");
  });
});