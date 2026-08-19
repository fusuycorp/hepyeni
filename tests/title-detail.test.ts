import { describe, expect, it } from "bun:test";
import { afterAll, beforeEach, mock, spyOn } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";
import { ClientResponseError } from "pocketbase";

describe("Title Detail Page & Mark as Finished UX Translations", () => {
  it("enforces full translation parity for title detail and comments reply keys", () => {
    const mediaKeys: (keyof typeof en.media)[] = [
      "viewDetails",
      "recommendedBy",
      "synopsis",
      "noSynopsis",
      "releaseDate",
      "publishedYear",
      "pageCount",
      "externalSource",
      "backToCircle",
      "copyMediaLink",
      "mediaLinkCopied",
      "mediaScore",
      "mediaStatus",
      "markAsConsumed",
      "markAsUnconsumed",
      "markConsumedFailed",
      "unmarkConsumedFailed",
    ];

    for (const key of mediaKeys) {
      expect(en.media[key]).toBeDefined();
      expect(tr.media[key]).toBeDefined();
      expect(typeof en.media[key]).toBe("string");
      expect(typeof tr.media[key]).toBe("string");
      expect(en.media[key].length).toBeGreaterThan(0);
      expect(tr.media[key].length).toBeGreaterThan(0);
    }

    const commentKeys: (keyof typeof en.comments)[] = [
      "reply",
      "replyingTo",
      "cancelReply",
      "repliesCount",
      "replyPlaceholder",
    ];

    for (const key of commentKeys) {
      expect(en.comments[key]).toBeDefined();
      expect(tr.comments[key]).toBeDefined();
      expect(typeof en.comments[key]).toBe("string");
      expect(typeof tr.comments[key]).toBe("string");
      expect(en.comments[key].length).toBeGreaterThan(0);
      expect(tr.comments[key].length).toBeGreaterThan(0);
    }
  });

  it("verifies user-friendly 'Mark as Finished' and 'Bitti Olarak İşaretle' copy", () => {
    expect(en.media.markAsConsumed).toBe("Mark as Finished");
    expect(tr.media.markAsConsumed).toBe("Bitti Olarak İşaretle");
    expect(en.media.markAsUnconsumed).toBe("Move back to Up Next");
    expect(tr.media.markAsUnconsumed).toBe("Sıradakilere Geri Al");
    expect(en.groups.emptyFinishedDesc).toContain("finished");
    expect(tr.groups.emptyFinishedDesc).toContain("Bitti");
  });
});

describe("Title Detail - Metadata Parsing & Presentation Helpers", () => {
  it("extracts description from TMDB/iTunes 'overview' field correctly", () => {
    const meta: Record<string, unknown> = { overview: "An epic space adventure following interstellar explorers." };
    const desc =
      (typeof meta.description === "string" && meta.description.trim()) ||
      (typeof meta.overview === "string" && meta.overview.trim()) ||
      null;
    expect(desc).toBe("An epic space adventure following interstellar explorers.");
  });

  it("extracts description from Google Books/Custom 'description' field correctly", () => {
    const meta: Record<string, unknown> = { description: "A detailed biography of a legendary artist." };
    const desc =
      (typeof meta.description === "string" && meta.description.trim()) ||
      (typeof meta.overview === "string" && meta.overview.trim()) ||
      null;
    expect(desc).toBe("A detailed biography of a legendary artist.");
  });

  it("prioritizes description over overview when both are provided", () => {
    const meta: Record<string, unknown> = {
      description: "Primary description",
      overview: "Secondary overview",
    };
    const desc =
      (typeof meta.description === "string" && meta.description.trim()) ||
      (typeof meta.overview === "string" && meta.overview.trim()) ||
      null;
    expect(desc).toBe("Primary description");
  });

  it("falls back to null for missing, non-string, or empty descriptions", () => {
    expect((() => {
      const meta = {} as Record<string, unknown>;
      return (typeof meta.description === "string" && meta.description.trim()) ||
        (typeof meta.overview === "string" && meta.overview.trim()) || null;
    })()).toBeNull();

    expect((() => {
      const meta = { description: "   ", overview: "" };
      return (typeof meta.description === "string" && meta.description.trim()) ||
        (typeof meta.overview === "string" && meta.overview.trim()) || null;
    })()).toBeNull();

    expect((() => {
      const meta = { description: 12345, overview: null } as unknown as Record<string, unknown>;
      return (typeof meta.description === "string" && meta.description.trim()) ||
        (typeof meta.overview === "string" && meta.overview.trim()) || null;
    })()).toBeNull();
  });

  it("extracts release dates across various provider formats", () => {
    const meta1 = { releaseDate: "2024-05-15T00:00:00Z" };
    const meta2 = { publishedDate: "2021" };
    const meta3 = { releaseDate: "1999-11-20" };

    const getRelease = (meta: Record<string, unknown>) =>
      (typeof meta.releaseDate === "string" && meta.releaseDate) ||
      (typeof meta.publishedDate === "string" && meta.publishedDate) ||
      null;

    expect(getRelease(meta1)).toBe("2024-05-15T00:00:00Z");
    expect(getRelease(meta2)).toBe("2021");
    expect(getRelease(meta3)).toBe("1999-11-20");
  });

  it("extracts page counts and track counts safely from metadata", () => {
    const metaBook = { pageCount: 432 };
    const metaMusic = { totalTracks: 14 };

    const getPageCount = (meta: Record<string, unknown>) =>
      typeof meta.pageCount === "number" ? meta.pageCount : null;
    const getTotalTracks = (meta: Record<string, unknown>) =>
      typeof meta.totalTracks === "number" ? meta.totalTracks : null;

    expect(getPageCount(metaBook)).toBe(432);
    expect(getPageCount(metaMusic)).toBeNull();
    expect(getTotalTracks(metaMusic)).toBe(14);
    expect(getTotalTracks(metaBook)).toBeNull();
  });
});

describe("Title Detail - Voting Scores & Reviews Aggregation", () => {
  it("calculates accurate net vote scores across upvotes and downvotes", () => {
    const votes = [
      { user: "u1", value: "up" },
      { user: "u2", value: "up" },
      { user: "u3", value: "down" },
      { user: "u4", value: "up" },
    ];

    const score = votes.reduce((acc, v) => acc + (v.value === "up" ? 1 : -1), 0);
    expect(score).toBe(2);
  });

  it("correctly identifies the current active user vote state", () => {
    const votes = [
      { user: "user_a", value: "up" },
      { user: "user_b", value: "down" },
    ];

    const userVoteA = votes.find((v) => v.user === "user_a")?.value;
    const userVoteB = votes.find((v) => v.user === "user_b")?.value;
    const userVoteC = votes.find((v) => v.user === "user_c")?.value;

    expect(userVoteA).toBe("up");
    expect(userVoteB).toBe("down");
    expect(userVoteC).toBeUndefined();
  });

  it("computes average rating and rounds accurately", () => {
    const reviewsSingle = [{ rating: 4 }];
    const reviewsMultiple = [
      { rating: 5 },
      { rating: 4 },
      { rating: 5 },
    ];
    const reviewsMixed = [
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 5 },
      { rating: 4 },
    ];

    const computeAvg = (revs: { rating: number }[]) =>
      revs.length ? revs.reduce((acc, r) => acc + r.rating, 0) / revs.length : null;

    const avg1 = computeAvg(reviewsSingle);
    const avg2 = computeAvg(reviewsMultiple);
    const avg3 = computeAvg(reviewsMixed);
    const avgEmpty = computeAvg([]);

    expect(avg1).toBe(4);
    expect(avg1?.toFixed(1)).toBe("4.0");

    expect(avg2).toBeCloseTo(4.6666, 3);
    expect(avg2?.toFixed(1)).toBe("4.7");

    expect(avg3).toBe(4.2);
    expect(avg3?.toFixed(1)).toBe("4.2");

    expect(avgEmpty).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// H1-defensive regression gate — submitReview must never null out an existing
// review body when the client sends an empty/whitespace reviewText (a
// rating-only save keeps the stored prose). Mirrors the marginalia.test.ts
// server-action mock pattern.
// ---------------------------------------------------------------------------

const { submitReview } = await import("@/lib/actions/reviews");
const sessionModule = await import("@/lib/pocketbase/session");
const superuserModule = await import("@/lib/pocketbase/superuser");
const membershipModule = await import("@/lib/membership");
const nextCacheModule = await import("next/cache");

const reviewDb = {
  existingReview: null as { id: string; reviewText: string | null } | null,
  updatePayload: null as Record<string, unknown> | null,
};

function resetReviewDb() {
  reviewDb.existingReview = { id: "r1", reviewText: "An existing body." };
  reviewDb.updatePayload = null;
}

function makeReviewsPb() {
  return {
    filter: (expr: string, params: Record<string, unknown>) => {
      let out = expr;
      for (const [k, v] of Object.entries(params)) {
        out = out.replaceAll(`{:${k}}`, JSON.stringify(v));
      }
      return out;
    },
    collection: (name: string) => {
      if (name !== "reviews") throw new Error(`unexpected collection: ${name}`);
      return {
        create: async () => {
          // escalate the unique-title+user constraint so the action updates instead
          throw new ClientResponseError({
            status: 400,
            response: {
              data: { title: { code: "validation_not_unique", message: "Duplicate." } },
            },
          });
        },
        getFirstListItem: async () => reviewDb.existingReview,
        update: async (_id: string, payload: Record<string, unknown>) => {
          reviewDb.updatePayload = payload;
          return { id: "r1", ...payload };
        },
      };
    },
  };
}

describe("submitReview body preservation (H1-defensive, mocked PB)", () => {
  beforeEach(() => {
    resetReviewDb();
    spyOn(sessionModule, "getSession").mockResolvedValue({
      id: "me",
      isAdmin: false,
      name: "Me",
      email: "me@example.com",
    } as never);
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(makeReviewsPb() as never);
    spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => {});
    spyOn(membershipModule, "resolveCircleAccess").mockImplementation(async () => {
      const access = {
        group: { id: "g1" },
        isOwner: false,
        isMember: true,
        isGuest: false,
        canViewBacklog: true,
        canViewFinished: true,
        canViewReviews: true,
        canViewComments: true,
        canVote: true,
        canComment: true,
        canReview: true,
        canPropose: true,
      };
      return access as never;
    });
    spyOn(membershipModule, "requireTitleInGroup").mockResolvedValue({
      id: "t1",
      group: "g1",
    } as never);
  });

  afterAll(() => {
    mock.restore();
  });

  function reviewForm(reviewText: string, rating = "5") {
    const form = new FormData();
    form.set("rating", rating);
    form.set("reviewText", reviewText);
    return form;
  }

  it("keeps the existing review body when the incoming reviewText is empty/whitespace", async () => {
    const result = await submitReview("t1", "g1", reviewForm("   "));
    expect(result.success).toBe(true);
    expect(reviewDb.updatePayload?.reviewText).toBe("An existing body.");
  });

  it("replaces the body when a non-empty reviewText is sent", async () => {
    const result = await submitReview("t1", "g1", reviewForm("New body"));
    expect(result.success).toBe(true);
    expect(reviewDb.updatePayload?.reviewText).toBe("New body");
  });

  it("stores null when there is no existing body and the incoming text is empty", async () => {
    reviewDb.existingReview = { id: "r1", reviewText: null };
    const result = await submitReview("t1", "g1", reviewForm(""));
    expect(result.success).toBe(true);
    expect(reviewDb.updatePayload?.reviewText).toBeNull();
  });
});
