"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canDeleteComment, validateCommentContent } from "@/lib/comments";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";
import type { CommentsResponse, UsersResponse } from "@/types/pocketbase-types";

export async function addComment(
  titleId: string,
  groupId: string,
  formData: FormData,
): Promise<CommentsResponse<{ user?: UsersResponse }>> {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

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
        throw new Error("Invalid parent comment");
      }
      // Enforce +1 depth max: If parent is already a reply, attach to its root parent
      parentId = parent.parentId || parent.id;
    } catch (err) {
      if (isNotFound(err)) throw new Error("Parent comment not found");
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

  return comment;
}

export async function getComments(
  titleId: string,
  groupId: string,
): Promise<CommentsResponse<{ user?: UsersResponse }>[]> {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

  const pb = await getSuperuserClient();
  return await pb
    .collection("comments")
    .getFullList<CommentsResponse<{ user?: UsersResponse }>>({
      filter: pb.filter("title = {:t}", { t: titleId }),
      sort: "createdAt",
      expand: "user",
    });
}

export async function deleteComment(commentId: string, groupId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const membership = await requireMembership(groupId, session.id);

  const pb = await getSuperuserClient();
  let comment: CommentsResponse;
  try {
    comment = await pb.collection("comments").getOne<CommentsResponse>(commentId);
  } catch (err) {
    if (isNotFound(err)) throw new Error("Comment not found");
    throw err;
  }

  if (comment.group !== groupId) {
    throw new Error("Comment does not belong to this group");
  }

  const allowed = canDeleteComment({
    commentUserId: comment.user,
    currentUserId: session.id,
    userRole: membership.role,
    isAdmin: session.isAdmin,
  });

  if (!allowed) {
    throw new Error("You are not authorized to delete this comment");
  }

  await pb.collection("comments").delete(commentId);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/titles/${comment.title}`);
  revalidatePath("/activity");
}

