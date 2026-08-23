import { describe, expect, it } from "bun:test";
import { projectCommentRow } from "@/lib/comments";
import { filterMilestoneCommentsForViewer } from "@/lib/schedules";
import type {
  CommentsResponse,
  MilestoneCommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

// R2 invariant: full UsersResponse records (containing email) must never reach
// the client payload — expanded users ship as {id, name, avatarUrl} only.

const OTHER_EMAIL = "other@private.example";

function user(id: string): UsersResponse {
  return {
    id,
    email: `${id}@private.example`,
    name: `User ${id}`,
    avatarUrl: `https://img.example/${id}.png`,
  } as UsersResponse;
}

function deepFindEmail(value: unknown): string | undefined {
  if (typeof value === "string") return value === OTHER_EMAIL ? value : undefined;
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = deepFindEmail(v);
      if (hit) return hit;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) {
      const hit = deepFindEmail(v);
      if (hit) return hit;
    }
  }
  return undefined;
}

describe("projectCommentRow", () => {
  it("projects expand.user to id/name/avatarUrl and strips every other field", () => {
    const row = {
      id: "cmt_1",
      title: "ttl_1",
      user: "usr_other",
      group: "grp_1",
      content: "hello",
      createdAt: "2026-08-20T10:00:00Z",
      updatedAt: "2026-08-20T10:00:00Z",
      collectionId: "comments",
      collectionName: "comments",
      expand: { user: user("usr_other") },
    };
    const out = projectCommentRow(row as unknown as CommentsResponse<{ user?: UsersResponse }>);
    expect(out.expand.user).toEqual({
      id: "usr_other",
      name: "User usr_other",
      avatarUrl: "https://img.example/usr_other.png",
    });
    expect(deepFindEmail(out)).toBeUndefined();
  });

  it("keeps comment body and threading fields intact", () => {
    const row = {
      id: "cmt_2",
      title: "ttl_1",
      user: "usr_a",
      group: "grp_1",
      content: "reply body",
      parentId: "cmt_1",
      createdAt: "2026-08-20T10:00:00Z",
      updatedAt: "2026-08-20T10:00:00Z",
      collectionId: "comments",
      collectionName: "comments",
      expand: { user: user("usr_a") },
    };
    const out = projectCommentRow(row as unknown as CommentsResponse<{ user?: UsersResponse }>);
    expect(out.content).toBe("reply body");
    expect(out.parentId).toBe("cmt_1");
  });
});

describe("filterMilestoneCommentsForViewer never leaks emails", () => {
  const recordRaw = () => ({
    id: "mc_1",
    milestone: "mls_1",
    user: "usr_other",
    group: "grp_1",
    content: `email me at ${OTHER_EMAIL}`,
    isSpoiler: false,
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
    collectionId: "milestone_comments",
    collectionName: "milestone_comments",
    expand: { user: { ...user("usr_other"), email: OTHER_EMAIL } },
  });
  const record = () =>
    recordRaw() as unknown as MilestoneCommentsResponse<{ user?: UsersResponse }>;

  it("unlocked path ships author without email", () => {
    const res = filterMilestoneCommentsForViewer([record()], true);
    expect(res.isLocked).toBe(false);
    expect(res.comments[0].author?.name).toBe("User usr_other");
    expect(res.comments[0].author).not.toHaveProperty("email");
    expect(deepFindEmail(res.comments)).toBeUndefined();
  });

  it("locked path ships author without email", () => {
    const res = filterMilestoneCommentsForViewer([record()], false);
    expect(res.isLocked).toBe(true);
    expect(res.comments[0].author).not.toHaveProperty("email");
  });
});
