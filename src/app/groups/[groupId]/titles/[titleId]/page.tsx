import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TitleDetailView } from "./title-detail-view";
import { markConsumed, unmarkConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { getTitleCircleProgress } from "@/lib/actions/progress";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { getServerTranslations } from "@/lib/i18n/server";
import { redactProposedTitles } from "@/lib/moods";
import type {
  CommentsResponse,
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

type TitleExpand = {
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
};

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; titleId: string }>;
}) {
  const session = await getSession();
  const { groupId, titleId } = await params;
  const t = await getServerTranslations();

  let access;
  try {
    access = await resolveCircleAccess(groupId, session?.id);
    await requireTitleInGroup(titleId, groupId);
  } catch {
    notFound();
  }

  if (!access.isMember && !access.group.isPublic) {
    if (!session) redirect("/login");
    notFound();
  }

  const group = access.group;
  const pb = await getSuperuserClient();

  const [titleRecord, userRecord, comments, memberProgress] = await Promise.all([
    pb.collection("titles").getOne<TitlesResponse<TitleExpand>>(titleId, {
      expand: "addedBy,votes_via_title,reviews_via_title.user",
    }),
    session?.id
      ? pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null)
      : Promise.resolve(null),
    access.canViewComments
      ? pb.collection("comments").getFullList<CommentsResponse<{ user?: UsersResponse }>>({
          filter: pb.filter("title = {:titleId} && group = {:groupId}", {
            titleId,
            groupId,
          }),
          expand: "user",
          sort: "createdAt",
        })
      : Promise.resolve([]),
    getTitleCircleProgress(titleId, groupId),
  ]);

  if (titleRecord.group !== groupId) {
    notFound();
  }

  const votes = titleRecord.expand?.votes_via_title ?? [];
  const score = votes.reduce(
    (acc, v) => acc + (v.value === "up" ? 1 : -1),
    0,
  );
  const userVote = session?.id
    ? votes.find((v) => v.user === session.id)?.value
    : undefined;

  const isOwnerOrAdmin = access.isOwner || Boolean(session?.isAdmin);
  const [redactedTitle] = redactProposedTitles(
    [titleRecord],
    access.group.isBlindPickEnabled,
    isOwnerOrAdmin,
  );

  const titleWithScore = {
    ...redactedTitle,
    score,
    userVote,
  };

  const currentUser = session
    ? {
        id: session.id,
        email: session.email,
        name: userRecord?.name,
        avatarUrl: userRecord?.avatarUrl,
        isAdmin: session.isAdmin,
      }
    : null;

  async function handleVote(value: "up" | "down") {
    "use server";
    await voteOnTitle(titleId, groupId, value);
  }

  async function handleMarkConsumed() {
    "use server";
    await markConsumed(titleId, groupId);
  }

  async function handleUnmarkConsumed() {
    "use server";
    await unmarkConsumed(titleId, groupId);
  }

  async function handleSubmitReview(formData: FormData) {
    "use server";
    await submitReview(titleId, groupId, formData);
  }

  async function handleAddComment(targetTitleId: string, formData: FormData) {
    "use server";
    return await addComment(targetTitleId, groupId, formData);
  }

  async function handleDeleteComment(commentId: string) {
    "use server";
    await deleteComment(commentId, groupId);
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
        title={titleWithScore}
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
