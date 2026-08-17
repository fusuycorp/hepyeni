import { describe, expect, it } from "bun:test";
import {
  canDeleteComment,
  organizeCommentsTree,
  validateCommentContent,
} from "@/lib/comments";

describe("Comments - Content Validation & Input Boundaries", () => {
  it("trims leading and trailing whitespace", () => {
    const input = "   Great book! Loved the ending.   ";
    expect(validateCommentContent(input)).toBe("Great book! Loved the ending.");
  });

  it("accepts a 1-character valid comment", () => {
    expect(validateCommentContent("A")).toBe("A");
    expect(validateCommentContent("  +  ")).toBe("+");
  });

  it("accepts maximum allowed length of 2000 characters", () => {
    const maxContent = "a".repeat(2000);
    expect(validateCommentContent(maxContent)).toBe(maxContent);
  });

  it("throws error for empty string or whitespace-only", () => {
    expect(() => validateCommentContent("")).toThrow("Comment content cannot be empty");
    expect(() => validateCommentContent("   \n\t  ")).toThrow("Comment content cannot be empty");
  });

  it("throws error for null or undefined", () => {
    expect(() => validateCommentContent(null)).toThrow("Comment content cannot be empty");
    expect(() => validateCommentContent(undefined)).toThrow("Comment content cannot be empty");
  });

  it("throws error when content exceeds 2000 characters", () => {
    const tooLong = "a".repeat(2001);
    expect(() => validateCommentContent(tooLong)).toThrow("Comment content cannot exceed 2000 characters");
  });

  it("preserves unicode, emojis, and multiline formatting cleanly", () => {
    const multiline = "Harika bir kitap! 📚✨\nKesinlikle okunmalı.\n\n— Ahmet";
    expect(validateCommentContent(multiline)).toBe(multiline);
  });

  it("handles Turkish special characters correctly without corruption", () => {
    const turkishText = "Çığır açan bir şaheser, özellikle ğ, ü, ş, ı, ö karakterleri.";
    expect(validateCommentContent(turkishText)).toBe(turkishText);
  });
});

describe("Comments - Deletion Authorization Logic", () => {
  const authorId = "user_author_123";
  const otherUserId = "user_other_456";
  const ownerId = "user_owner_789";
  const adminId = "user_admin_999";

  it("allows the comment author to delete their own comment", () => {
    const result = canDeleteComment({
      commentUserId: authorId,
      currentUserId: authorId,
      userRole: "member",
      isAdmin: false,
    });
    expect(result).toBe(true);
  });

  it("denies another normal member from deleting the comment", () => {
    const result = canDeleteComment({
      commentUserId: authorId,
      currentUserId: otherUserId,
      userRole: "member",
      isAdmin: false,
    });
    expect(result).toBe(false);
  });

  it("allows circle owner to delete any comment in the circle", () => {
    const result = canDeleteComment({
      commentUserId: authorId,
      currentUserId: ownerId,
      userRole: "owner",
      isAdmin: false,
    });
    expect(result).toBe(true);
  });

  it("allows system admin to delete any comment", () => {
    const result = canDeleteComment({
      commentUserId: authorId,
      currentUserId: adminId,
      userRole: "member",
      isAdmin: true,
    });
    expect(result).toBe(true);
  });

  it("denies deletion when currentUserId is missing/empty", () => {
    const result = canDeleteComment({
      commentUserId: authorId,
      currentUserId: "",
      userRole: "owner",
      isAdmin: true,
    });
    expect(result).toBe(false);
  });
});

describe("Comments - +1 Depth Replies Hierarchy & Tree Organization", () => {
  it("organizes flat comments into root comments and nested replies", () => {
    const flat = [
      { id: "c1", content: "Root 1", createdAt: "2026-08-17T10:00:00Z" },
      { id: "c2", content: "Reply 1 to Root 1", parentId: "c1", createdAt: "2026-08-17T10:05:00Z" },
      { id: "c3", content: "Root 2", createdAt: "2026-08-17T10:10:00Z" },
      { id: "c4", content: "Reply 2 to Root 1", parentId: "c1", createdAt: "2026-08-17T10:15:00Z" },
    ];

    const tree = organizeCommentsTree(flat);
    expect(tree.length).toBe(2);
    expect(tree[0].id).toBe("c1");
    expect(tree[0].replies.length).toBe(2);
    expect(tree[0].replies[0].id).toBe("c2");
    expect(tree[0].replies[1].id).toBe("c4");
    expect(tree[1].id).toBe("c3");
    expect(tree[1].replies.length).toBe(0);
  });

  it("handles out-of-order flat comments and sorts chronologically", () => {
    const flat = [
      { id: "c3", content: "Root 2", createdAt: "2026-08-17T11:00:00Z" },
      { id: "c1", content: "Root 1", createdAt: "2026-08-17T09:00:00Z" },
      { id: "c2", content: "Reply to Root 1", parentId: "c1", createdAt: "2026-08-17T10:00:00Z" },
    ];

    const tree = organizeCommentsTree(flat);
    expect(tree[0].id).toBe("c1");
    expect(tree[0].replies[0].id).toBe("c2");
    expect(tree[1].id).toBe("c3");
  });

  it("treats orphan replies without valid root as fallback root comments", () => {
    const flat = [
      { id: "c2", content: "Orphan reply", parentId: "nonexistent", createdAt: "2026-08-17T10:00:00Z" },
    ];

    const tree = organizeCommentsTree(flat);
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe("c2");
    expect(tree[0].parentId).toBeUndefined();
  });

  it("handles complex multi-root and multi-reply discussion threads", () => {
    const flat = [
      { id: "c1", content: "Book review discussion", createdAt: "2026-08-17T08:00:00Z" },
      { id: "c2", content: "I agree with chapter 3", parentId: "c1", createdAt: "2026-08-17T08:10:00Z" },
      { id: "c3", content: "What about the ending?", parentId: "c1", createdAt: "2026-08-17T08:20:00Z" },
      { id: "c4", content: "Alternative translation note", createdAt: "2026-08-17T09:00:00Z" },
      { id: "c5", content: "Which publisher did you read?", parentId: "c4", createdAt: "2026-08-17T09:05:00Z" },
      { id: "c6", content: "Standalone praise", createdAt: "2026-08-17T10:00:00Z" },
    ];

    const tree = organizeCommentsTree(flat);
    expect(tree.length).toBe(3);

    // First thread
    expect(tree[0].id).toBe("c1");
    expect(tree[0].replies.length).toBe(2);
    expect(tree[0].replies[0].id).toBe("c2");
    expect(tree[0].replies[1].id).toBe("c3");

    // Second thread
    expect(tree[1].id).toBe("c4");
    expect(tree[1].replies.length).toBe(1);
    expect(tree[1].replies[0].id).toBe("c5");

    // Third thread
    expect(tree[2].id).toBe("c6");
    expect(tree[2].replies.length).toBe(0);
  });

  it("enforces depth limit: when reply targets another reply, backend resolution attaches to root", () => {
    // Simulating parentId resolution in addComment: parent.parentId || parent.id
    const existingComments = [
      { id: "root_1", parentId: null },
      { id: "reply_1", parentId: "root_1" },
    ];

    function resolveParentId(targetId: string): string {
      const target = existingComments.find((c) => c.id === targetId);
      if (!target) throw new Error("Not found");
      return target.parentId || target.id;
    }

    expect(resolveParentId("root_1")).toBe("root_1");
    expect(resolveParentId("reply_1")).toBe("root_1"); // Collapses to root (+1 depth max!)
  });
});
