"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canDeleteComment, validateCommentContent } from "@/lib/comments";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";
import type { CommentsResponse } from "@/types/pocketbase-types";

export async function addComment(
  titleId: string,
  groupId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

  const rawContent = formData.get("content");
  const content = validateCommentContent(rawContent);

  const pb = await getSuperuserClient();
  await pb.collection("comments").create({
    title: titleId,
    user: session.id,
    group: groupId,
    content,
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/activity");
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
  revalidatePath("/activity");
}
