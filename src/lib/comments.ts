import type { CommentsResponse, UsersResponse } from "@/types/pocketbase-types";
import { pickReviewerUser, type ReviewerUser } from "@/lib/group-titles";

// R2 invariant: comment authors ship to the client as {id, name, avatarUrl}
// only — the full expanded UsersResponse (with email) never leaves the server.
export type PublicComment = CommentsResponse<{ user?: ReviewerUser }>;

export function projectCommentRow(
  row: CommentsResponse<{ user?: UsersResponse }>,
): PublicComment {
  const author = pickReviewerUser(row.expand?.user);
  return {
    ...row,
    expand: author ? { user: author } : {},
  };
}

export function validateCommentContent(raw: unknown): string {
  if (raw === null || raw === undefined) {
    throw new Error("Comment content cannot be empty");
  }
  let content: string;
  try {
    content = String(raw).trim();
  } catch {
    throw new Error("Comment content cannot be empty");
  }
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

export type CommentNode<T> = T & {
  replies: CommentNode<T>[];
};

export function organizeCommentsTree<
  T extends { id: string; parentId?: string | null; createdAt: string }
>(flatComments: T[]): CommentNode<T>[] {
  const rootComments: CommentNode<T>[] = [];
  const rootMap = new Map<string, CommentNode<T>>();

  // First pass: collect top-level comments (sorted chronologically)
  const sorted = [...flatComments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const c of sorted) {
    if (!c.parentId) {
      const node: CommentNode<T> = { ...c, replies: [] };
      rootComments.push(node);
      rootMap.set(c.id, node);
    }
  }

  // Second pass: attach replies to their parent (enforcing +1 depth max)
  for (const c of sorted) {
    if (c.parentId) {
      const parent = rootMap.get(c.parentId);
      if (parent) {
        parent.replies.push({ ...c, replies: [] });
      } else {
        // Fallback: If parent not found among roots (e.g. orphan), treat as root
        const node: CommentNode<T> = { ...c, parentId: undefined, replies: [] };
        rootComments.push(node);
        rootMap.set(c.id, node);
      }
    }
  }

  return rootComments;
}

