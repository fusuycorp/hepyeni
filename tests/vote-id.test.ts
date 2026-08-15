import { describe, expect, it } from "bun:test";
import { voteRecordId } from "@/lib/pocketbase/vote-id";

describe("voteRecordId", () => {
  it("generates a deterministic 15-character base36 ID", async () => {
    const id = await voteRecordId("title123", "user456");
    expect(id).toHaveLength(15);
    expect(id).toMatch(/^[a-z0-9]{15}$/);
  });

  it("is idempotent for the same titleId and userId", async () => {
    const id1 = await voteRecordId("group_title_abc", "user_xyz");
    const id2 = await voteRecordId("group_title_abc", "user_xyz");
    expect(id1).toBe(id2);
  });

  it("produces distinct IDs for different titles or users", async () => {
    const id1 = await voteRecordId("title_1", "user_1");
    const id2 = await voteRecordId("title_2", "user_1");
    const id3 = await voteRecordId("title_1", "user_2");

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });

  it("differentiates argument order (title vs user)", async () => {
    const id1 = await voteRecordId("abc", "def");
    const id2 = await voteRecordId("def", "abc");
    expect(id1).not.toBe(id2);
  });
});
