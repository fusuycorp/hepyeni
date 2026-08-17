import { describe, expect, it } from "bun:test";
import { canDeleteComment, validateCommentContent } from "@/lib/comments";

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
