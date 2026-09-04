import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TitleDetailView } from "./title-detail-view";
import { markConsumed, unmarkConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { getTitleCircleProgress } from "@/lib/queries/progress";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireTitleInGroup, resolveCircleAccess } from "@/lib/membership";
import { getServerTranslations } from "@/lib/i18n/server";
import { redactProposedTitles } from "@/lib/moods";
import {
  computeScoreAndUserVote,
  groupTitleQuery,
  mapGroupReviewRow,
  type GroupReviewRow,
  type GroupTitleExpand,
} from "@/lib/group-titles";
import { projectCommentRow, type PublicComment } from "@/lib/comments";
import type {
  CommentsResponse,
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; titleId: string }>;
}) {
  const session = await getSession();
  const { groupId, titleId } = await params;
  const t = await getServerTranslations();

  let access;
  let titleInGroup;
  try {
    access = await resolveCircleAccess(groupId, session?.id);
    titleInGroup = await requireTitleInGroup(titleId, groupId);
  } catch {
    notFound();
  }

  if (!access.isMember && !access.group.isPublic) {
    if (!session) redirect("/login");
    notFound();
  }

  const group = access.group;
  const pb = await getSuperuserClient();

  // S3-title (security): never ship review records (full reviewText + reviewer
  // identity) to viewers without review visibility — mirror the comments
  // server-gating pattern used on the group page. Voter/reviewer identity under
  // blind pick is stripped from the client-bound copy by redactProposedTitles
  // (src/lib/moods.ts); the score/userVote scalars below are computed from the
  // server-side records before redaction.
  //
  // R2: the title fetch uses the shared groupTitleQuery wire projection (lean
  // votes, addedBy trimmed to id/name/avatarUrl). Reviews ride a separate lean
  // query on the `reviews` collection — PocketBase 0.39 cannot project the
  // nested reviews_via_title.user expand (see src/lib/group-titles.ts).
  const titleQuery = groupTitleQuery(access.canViewReviews);

  const [titleRecord, leanReviewRows, ownReviewRows, comments, memberProgress] =
    await Promise.all([
      pb.collection("titles").getOne<TitlesResponse<GroupTitleExpand>>(titleId, {
        expand: titleQuery.expand,
        fields: titleQuery.fields,
      }),
      access.canViewReviews
        ? pb
            .collection("reviews")
            .getFullList<ReviewsResponse<{ user?: UsersResponse }>>({
              filter: pb.filter("title = {:titleId}", { titleId }),
              sort: "-createdAt",
              expand: "user",
              fields:
                "id,title,user,rating,createdAt," +
                "expand.user.id,expand.user.name,expand.user.avatarUrl",
            })
        : Promise.resolve([]),
      access.canViewReviews && session?.id
        ? pb.collection("reviews").getFullList<ReviewsResponse>({
            filter: pb.filter("user = {:userId} && title = {:titleId}", {
              userId: session.id,
              titleId,
            }),
            fields: "id,title,reviewText",
          })
        : Promise.resolve([]),
      access.canViewComments
        ? pb
            .collection("comments")
            .getFullList<CommentsResponse<{ user?: UsersResponse }>>({
              filter: pb.filter("title = {:titleId} && group = {:groupId}", {
                titleId,
                groupId,
              }),
              expand: "user",
              sort: "createdAt",
              fields:
                "id,title,user,group,content,parentId,createdAt," +
                "expand.user.id,expand.user.name,expand.user.avatarUrl",
            })
        : Promise.resolve([]),
      // H-1: pass the already-resolved title (requireTitleInGroup), session, and
      // access so getTitleCircleProgress skips its own auth/access/title round trips.
      getTitleCircleProgress(titleId, titleInGroup, groupId, session, access),
    ]);

  if (titleRecord.group !== groupId) {
    notFound();
  }

  // R2: reviewer identities are projected to id/name/avatarUrl; only the
  // current viewer's own review body survives (ReviewForm prefill).
  const ownReviewTextByTitle = new Map<string, string>();
  for (const r of ownReviewRows) {
    if (r.reviewText && r.title) ownReviewTextByTitle.set(r.title, r.reviewText);
  }
  const reviewRows: GroupReviewRow[] = leanReviewRows.map((r) =>
    mapGroupReviewRow(r, session?.id, ownReviewTextByTitle),
  );

  const votes = titleRecord.expand?.votes_via_title ?? [];
  const { score, userVote } = computeScoreAndUserVote(votes, session?.id);

  const isOwnerOrAdmin = access.isOwner || Boolean(session?.isAdmin);
  // Attach projected reviews BEFORE redaction so blind pick can strip them for
  // non-owner viewers of proposed titles (same order as the group page).
  const withReviews: TitlesResponse<GroupTitleExpand> = {
    ...titleRecord,
    expand: { ...titleRecord.expand, reviews_via_title: reviewRows },
  };
  const [redactedTitle] = redactProposedTitles(
    [withReviews],
    access.group.isBlindPickEnabled,
    isOwnerOrAdmin,
  );

  const titleWithScore = {
    ...redactedTitle,
    score,
    userVote,
  };

  const publicComments: PublicComment[] = comments.map(projectCommentRow);

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
        title={titleWithScore}
        comments={publicComments}
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
