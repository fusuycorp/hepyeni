"use server";

import { revalidatePath } from "next/cache";
import { canDeleteComment, validateCommentContent } from "@/lib/comments";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type { CommentsResponse, UsersResponse } from "@/types/pocketbase-types";

// ponytail: action-layer error strings are hardcoded English (unified from a
// TR/EN mix). Ceiling: actions should return stable error codes mapped to
// client-side translations (useTranslations) for full TR/EN parity; until then
// EN keeps every locale's toasts readable and consistent.

export async function addComment(
  titleId: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult<CommentsResponse<{ user?: { id: string; name?: string; avatarUrl?: string } }>>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    // M-4: independent reads — access and title-in-group in parallel.
    const [access] = await Promise.all([
      resolveCircleAccess(groupId, session.id),
      requireTitleInGroup(titleId, groupId),
    ]);
    if (!access.canComment) {
      return { success: false, error: "You do not have permission to comment in this circle." };
    }

    const rawContent = formData.get("content");
    const content = validateCommentContent(rawContent);

    const pb = await getSuperuserClient();

    const rawParentId = formData.get("parentId");
    let parentId: string | null = null;
    if (rawParentId && typeof rawParentId === "string" && rawParentId.trim()) {
      const cleanParentId = rawParentId.trim();
      try {
        const parent = await pb
          .collection("comments")
          .getOne<CommentsResponse>(cleanParentId);
        if (parent.title !== titleId || parent.group !== groupId) {
          return { success: false, error: "Invalid parent comment." };
        }
        // Enforce +1 depth max: If parent is already a reply, attach to its root parent
        parentId = parent.parentId || parent.id;
      } catch (err) {
        if (isNotFound(err)) return { success: false, error: "Parent comment not found." };
        throw err;
      }
    }

    const comment = await pb
      .collection("comments")
      .create<CommentsResponse<{ user?: UsersResponse }>>(
        {
          title: titleId,
          user: session.id,
          group: groupId,
          content,
          parentId,
        },
        { expand: "user" },
      );

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${titleId}`);
    revalidatePath("/activity");

    return { success: true, data: { ...comment, expand: comment.expand?.user ? { user: { id: comment.expand.user.id, name: comment.expand.user.name, avatarUrl: comment.expand.user.avatarUrl } } : undefined } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addComment", titleId, groupId });
    return { success: false, error: "Failed to add comment.", traceId: diag.traceId };
  }
}

export async function getComments(
  titleId: string,
  groupId: string,
): Promise<CommentsResponse<{ user?: { id: string; name?: string; avatarUrl?: string } }>[]> {
  const session = await getSession();
  const access = await resolveCircleAccess(groupId, session?.id);
  if (!access.canViewComments) {
    return [];
  }

  try {
    await requireTitleInGroup(titleId, groupId);
    const pb = await getSuperuserClient();
    const records = await pb
      .collection("comments")
      .getFullList<CommentsResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("title = {:t}", { t: titleId }),
        sort: "createdAt",
        expand: "user",
      });
    return records.map(r => ({ ...r, expand: r.expand?.user ? { user: { id: r.expand.user.id, name: r.expand.user.name, avatarUrl: r.expand.user.avatarUrl } } : undefined }));
  } catch (err) {
    logDiagnostic(err, { action: "getComments", titleId, groupId });
    return [];
  }
}

export async function deleteComment(
  commentId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    const pb = await getSuperuserClient();
    let comment: CommentsResponse;
    try {
      comment = await pb.collection("comments").getOne<CommentsResponse>(commentId);
    } catch (err) {
      if (isNotFound(err)) return { success: false, error: "Comment not found." };
      throw err;
    }

    if (comment.group !== groupId) {
      return { success: false, error: "Comment does not belong to this group." };
    }

    const allowed = canDeleteComment({
      commentUserId: comment.user,
      currentUserId: session.id,
      userRole: access.isOwner ? "owner" : access.isMember ? "member" : undefined,
      isAdmin: session.isAdmin,
    });

    if (!allowed) {
      return { success: false, error: "You do not have permission to delete this comment." };
    }

    await pb.collection("comments").delete(commentId);

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/titles/${comment.title}`);
    revalidatePath("/activity");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteComment", commentId, groupId });
    return { success: false, error: "Failed to delete comment.", traceId: diag.traceId };
  }
}
