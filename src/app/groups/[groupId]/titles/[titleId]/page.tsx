import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TitleDetailView } from "./title-detail-view";
import { markConsumed, unmarkConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";
import { getServerTranslations } from "@/lib/i18n/server";
import type {
  CommentsResponse,
  GroupMembersResponse,
  GroupsResponse,
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
  if (!session) redirect("/login");

  const { groupId, titleId } = await params;
  const pb = await getSuperuserClient();
  const t = await getServerTranslations();

  let membership: GroupMembersResponse;
  try {
    membership = await requireMembership(groupId, session.id);
    await requireTitleInGroup(titleId, groupId);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  const [group, titleRecord, userRecord, comments] = await Promise.all([
    pb.collection("groups").getOne<GroupsResponse>(groupId),
    pb.collection("titles").getOne<TitlesResponse<TitleExpand>>(titleId, {
      expand: "addedBy,votes_via_title,reviews_via_title.user",
    }),
    pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null),
    pb.collection("comments").getFullList<CommentsResponse<{ user?: UsersResponse }>>({
      filter: pb.filter("title = {:titleId} && group = {:groupId}", {
        titleId,
        groupId,
      }),
      expand: "user",
      sort: "createdAt",
    }),
  ]);

  if (titleRecord.group !== groupId) {
    notFound();
  }

  const votes = titleRecord.expand?.votes_via_title ?? [];
  const score = votes.reduce(
    (acc, v) => acc + (v.value === "up" ? 1 : -1),
    0,
  );
  const userVote = votes.find((v) => v.user === session.id)?.value;

  const titleWithScore = {
    ...titleRecord,
    score,
    userVote,
  };

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

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
        currentUserId={session.id}
        currentUserRole={membership.role}
        isAdmin={session.isAdmin}
        currentUserName={currentUser.name}
        currentUserEmail={currentUser.email}
        currentUserAvatarUrl={currentUser.avatarUrl}
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
