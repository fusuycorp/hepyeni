export function validateCommentContent(raw: unknown): string {
  if (raw === null || raw === undefined) {
    throw new Error("Comment content cannot be empty");
  }
  const content = String(raw).trim();
  if (content.length < 1) {
    throw new Error("Comment content cannot be empty");
  }
  if (content.length > 2000) {
    throw new Error("Comment content cannot exceed 2000 characters");
  }
  return content;
}

export function canDeleteComment({
  commentUserId,
  currentUserId,
  userRole,
  isAdmin,
}: {
  commentUserId: string;
  currentUserId: string;
  userRole?: string;
  isAdmin?: boolean;
}): boolean {
  if (!currentUserId) return false;
  if (commentUserId === currentUserId) return true;
  if (userRole === "owner") return true;
  if (isAdmin === true) return true;
  return false;
}
