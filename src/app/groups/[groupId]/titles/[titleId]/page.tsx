import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TitleDetailView } from "./title-detail-view";
import { markConsumed, unmarkConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { getSession } from "@/lib/pocketbase/session";
import { fetchCircleTitleDetail } from "@/lib/queries/circle-feed";

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; titleId: string }>;
}) {
  const session = await getSession();
  const { groupId, titleId } = await params;

  let detail;
  try {
    detail = await fetchCircleTitleDetail(groupId, titleId, session);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCESS_DENIED") {
      if (!session) redirect("/login");
      notFound();
    }
    notFound();
  }

  const { access, group, title, comments, memberProgress } = detail;

  const currentUser = session
    ? {
        id: session.id,
        email: session.email,
        name: session.name,
        avatarUrl: session.avatarUrl,
        isAdmin: session.isAdmin,
      }
    : null;

  async function handleVote(value: "up" | "down") {
    "use server";
    return await voteOnTitle(titleId, groupId, value);
  }

  async function handleMarkConsumed() {
    "use server";
    return await markConsumed(titleId, groupId);
  }

  async function handleUnmarkConsumed() {
    "use server";
    return await unmarkConsumed(titleId, groupId);
  }

  async function handleSubmitReview(formData: FormData) {
    "use server";
    return await submitReview(titleId, groupId, formData);
  }

  async function handleAddComment(targetTitleId: string, formData: FormData) {
    "use server";
    return await addComment(targetTitleId, groupId, formData);
  }

  async function handleDeleteComment(commentId: string) {
    "use server";
    return await deleteComment(commentId, groupId);
  }

  async function handleGetComments(targetTitleId: string) {
    "use server";
    return await getComments(targetTitleId, groupId);
  }

  return (
    <AppShell
      user={currentUser}
      maxWidth="default"
      backHref={`/groups/${groupId}`}
      backLabel={group.name}
    >
      <TitleDetailView
        group={group}
        title={title}
        comments={comments}
        memberProgress={memberProgress}
        currentUserId={session?.id ?? ""}
        currentUserRole={access.isOwner ? "owner" : access.isMember ? "member" : undefined}
        isAdmin={session?.isAdmin}
        currentUserName={currentUser?.name}
        currentUserEmail={currentUser?.email}
        currentUserAvatarUrl={currentUser?.avatarUrl}
        isGuest={access.isGuest}
        canViewReviews={access.canViewReviews}
        canViewComments={access.canViewComments}
        canVote={access.canVote}
        canComment={access.canComment}
        canReview={access.canReview}
        onVote={handleVote}
        onMarkConsumed={handleMarkConsumed}
        onUnmarkConsumed={handleUnmarkConsumed}
        onSubmitReview={handleSubmitReview}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onFetchComments={handleGetComments}
      />
    </AppShell>
  );
}
