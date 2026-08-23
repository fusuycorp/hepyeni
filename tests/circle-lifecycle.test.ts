import { describe, expect, it } from "bun:test";
import {
  categorizeCircleTitles,
  type MemberTitleProgress,
  type TitlePayload,
} from "@/lib/group-titles";

function makeTitle(
  id: string,
  extra: Partial<TitlePayload> = {},
): TitlePayload {
  return {
    id,
    title: `Title ${id}`,
    creator: `Creator ${id}`,
    mediaType: "book",
    coverUrl: "",
    status: "proposed",
    createdAt: "2026-08-01T00:00:00.000Z",
    addedBy: "usr_1",
    group: "grp_1",
    externalId: "",
    externalSource: "",
    metadata: null,
    collectionId: "titles",
    collectionName: "titles",
    score: 0,
    expand: {},
    ...extra,
  } as TitlePayload;
}

describe("Circle Media Lifecycle — categorizeCircleTitles", () => {
  const memberIds = ["usr_alice", "usr_bob", "usr_charlie"];

  it("places titles with no member progress into 'proposed' (Up Next)", () => {
    const t1 = makeTitle("t1");
    const progressMap = new Map<string, MemberTitleProgress[]>();

    const result = categorizeCircleTitles([t1], progressMap, memberIds, "usr_alice");

    expect(result.proposed.length).toBe(1);
    expect(result.inProgress.length).toBe(0);
    expect(result.consumed.length).toBe(0);
    expect(result.proposed[0].id).toBe("t1");
    expect(result.proposed[0].progressSummary).toEqual({
      finishedCount: 0,
      inProgressCount: 0,
      totalMembers: 3,
      allMembersFinished: false,
      currentUserStatus: "not_started",
    });
  });

  it("places titles with at least 1 member 'in_progress' into 'inProgress' (In Progress)", () => {
    const t1 = makeTitle("t1");
    const progressMap = new Map<string, MemberTitleProgress[]>([
      [
        "t1",
        [
          {
            userId: "usr_alice",
            status: "in_progress",
            progressCurrent: 50,
            progressTotal: 200,
            progressUnit: "pages",
          },
        ],
      ],
    ]);

    const result = categorizeCircleTitles([t1], progressMap, memberIds, "usr_alice");

    expect(result.proposed.length).toBe(0);
    expect(result.inProgress.length).toBe(1);
    expect(result.consumed.length).toBe(0);
    expect(result.inProgress[0].progressSummary).toEqual({
      finishedCount: 0,
      inProgressCount: 1,
      totalMembers: 3,
      allMembersFinished: false,
      currentUserStatus: "in_progress",
    });
  });

  it("places titles where 1 member finished but others have not into 'inProgress' (In Progress)", () => {
    const t1 = makeTitle("t1");
    const progressMap = new Map<string, MemberTitleProgress[]>([
      [
        "t1",
        [
          {
            userId: "usr_alice",
            status: "completed",
          },
        ],
      ],
    ]);

    const result = categorizeCircleTitles([t1], progressMap, memberIds, "usr_bob");

    expect(result.proposed.length).toBe(0);
    expect(result.inProgress.length).toBe(1);
    expect(result.consumed.length).toBe(0);
    expect(result.inProgress[0].progressSummary).toEqual({
      finishedCount: 1,
      inProgressCount: 0,
      totalMembers: 3,
      allMembersFinished: false,
      currentUserStatus: "not_started",
    });
  });

  it("places titles where 100% of circle members finished into 'consumed' (Finished)", () => {
    const t1 = makeTitle("t1");
    const progressMap = new Map<string, MemberTitleProgress[]>([
      [
        "t1",
        [
          { userId: "usr_alice", status: "completed" },
          { userId: "usr_bob", status: "completed" },
          { userId: "usr_charlie", status: "completed" },
        ],
      ],
    ]);

    const result = categorizeCircleTitles([t1], progressMap, memberIds, "usr_alice");

    expect(result.proposed.length).toBe(0);
    expect(result.inProgress.length).toBe(0);
    expect(result.consumed.length).toBe(1);
    expect(result.consumed[0].progressSummary).toEqual({
      finishedCount: 3,
      inProgressCount: 0,
      totalMembers: 3,
      allMembersFinished: true,
      currentUserStatus: "completed",
    });
  });

  it("preserves historical 'consumed' titles in 'consumed' (Finished) even if progress records are absent", () => {
    const tHistorical = makeTitle("t_hist", { status: "consumed" });
    const progressMap = new Map<string, MemberTitleProgress[]>();

    const result = categorizeCircleTitles([tHistorical], progressMap, memberIds, "usr_alice");

    expect(result.proposed.length).toBe(0);
    expect(result.inProgress.length).toBe(0);
    expect(result.consumed.length).toBe(1);
    expect(result.consumed[0].progressSummary.allMembersFinished).toBe(true);
  });

  it("correctly handles single-member circles", () => {
    const singleMember = ["usr_alice"];
    const t1 = makeTitle("t1");

    // 1. Unstarted -> proposed
    let res = categorizeCircleTitles([t1], new Map(), singleMember, "usr_alice");
    expect(res.proposed.length).toBe(1);
    expect(res.inProgress.length).toBe(0);
    expect(res.consumed.length).toBe(0);

    // 2. In progress -> inProgress
    const inProgMap = new Map<string, MemberTitleProgress[]>([
      ["t1", [{ userId: "usr_alice", status: "in_progress" }]],
    ]);
    res = categorizeCircleTitles([t1], inProgMap, singleMember, "usr_alice");
    expect(res.proposed.length).toBe(0);
    expect(res.inProgress.length).toBe(1);
    expect(res.consumed.length).toBe(0);

    // 3. Completed -> consumed (since 1/1 members finished)
    const completedMap = new Map<string, MemberTitleProgress[]>([
      ["t1", [{ userId: "usr_alice", status: "completed" }]],
    ]);
    res = categorizeCircleTitles([t1], completedMap, singleMember, "usr_alice");
    expect(res.proposed.length).toBe(0);
    expect(res.inProgress.length).toBe(0);
    expect(res.consumed.length).toBe(1);
  });

  it("ignores progress of users who are no longer in the circle", () => {
    const t1 = makeTitle("t1");
    const progressMap = new Map<string, MemberTitleProgress[]>([
      [
        "t1",
        [
          { userId: "usr_ex_member", status: "completed" },
        ],
      ],
    ]);

    const result = categorizeCircleTitles([t1], progressMap, ["usr_alice", "usr_bob"], "usr_alice");

    // Since usr_ex_member is not in memberIds, t1 should still be 'proposed'
    expect(result.proposed.length).toBe(1);
    expect(result.inProgress.length).toBe(0);
    expect(result.consumed.length).toBe(0);
    expect(result.proposed[0].progressSummary.finishedCount).toBe(0);
  });

  it("categorizes multiple titles simultaneously into their respective buckets", () => {
    const tUnstarted = makeTitle("t_unstarted");
    const tInProgress = makeTitle("t_in_progress");
    const tPartial = makeTitle("t_partial");
    const tAllDone = makeTitle("t_all_done");
    const tHist = makeTitle("t_hist", { status: "consumed" });

    const progressMap = new Map<string, MemberTitleProgress[]>([
      [
        "t_in_progress",
        [{ userId: "usr_alice", status: "in_progress" }],
      ],
      [
        "t_partial",
        [{ userId: "usr_alice", status: "completed" }, { userId: "usr_bob", status: "in_progress" }],
      ],
      [
        "t_all_done",
        [
          { userId: "usr_alice", status: "completed" },
          { userId: "usr_bob", status: "completed" },
          { userId: "usr_charlie", status: "completed" },
        ],
      ],
    ]);

    const result = categorizeCircleTitles(
      [tUnstarted, tInProgress, tPartial, tAllDone, tHist],
      progressMap,
      memberIds,
      "usr_alice",
    );

    expect(result.proposed.map((t) => t.id)).toEqual(["t_unstarted"]);
    expect(result.inProgress.map((t) => t.id)).toEqual(["t_in_progress", "t_partial"]);
    expect(result.consumed.map((t) => t.id)).toEqual(["t_all_done", "t_hist"]);
  });

  it("handles empty member lists safely", () => {
    const t1 = makeTitle("t1");
    const tHist = makeTitle("t_hist", { status: "consumed" });

    const result = categorizeCircleTitles([t1, tHist], new Map(), [], "usr_alice");

    expect(result.proposed.length).toBe(1);
    expect(result.inProgress.length).toBe(0);
    expect(result.consumed.length).toBe(1);
  });
});

