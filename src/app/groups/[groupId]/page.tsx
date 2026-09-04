import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings, Plus, Globe, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { buttonVariants } from "@/components/ui/button";
import { GroupContentView } from "./group-content-view";
import { markConsumed, unmarkConsumed, startConsuming } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { getGroupSchedules } from "@/lib/queries/schedules";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { resolveCircleAccess } from "@/lib/membership";
import { getServerTranslations } from "@/lib/i18n/server";
import { redactProposedTitles } from "@/lib/moods";
import {
  buildTitlePayload,
  categorizeCircleTitles,
  groupTitleQuery,
  type LeanVoteRow,
  type MemberTitleProgress,
  type TitleWithProgress,
} from "@/lib/group-titles";
import type {
  CommentsResponse,
  GroupMembersResponse,
  ReviewsResponse,
  TitlesResponse,
  UserMediaProgressResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

type TitleExpand = {
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  const { groupId } = await params;
  const t = await getServerTranslations();

  let access;
  try {
    access = await resolveCircleAccess(groupId, session?.id);
  } catch {
    notFound();
  }

  if (!access.isMember && !access.group.isPublic) {
    if (!session) redirect("/login");
    notFound();
  }

  const group = access.group;
  const pb = await getSuperuserClient();

  const canViewReviews = access.canViewReviews;
  const needsTitles = access.canViewBacklog || access.canViewFinished;
  const titleQuery = groupTitleQuery(canViewReviews);

  const [
    members,
    groupTitles,
    commentRows,
    schedules,
    leanVoteRows,
    ownReviewRows,
    leanReviewRows,
    memberProgressRows,
  ] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      }),
    // H-3/L4: project at the wire. Titles carry only what the client renders;
    // review bodies are excluded (they arrive per-title via the lean own-review
    // query below) and reviewer users are trimmed to id/name/avatarUrl so
    // emails never leave the server.
    needsTitles
      ? pb.collection("titles").getFullList<TitlesResponse<TitleExpand>>({
          filter: pb.filter("group = {:groupId}", { groupId }),
          expand: titleQuery.expand,
          fields: titleQuery.fields,
          sort: "-createdAt",
        })
      : Promise.resolve([]),
    access.canViewComments
      ? pb.collection("comments").getFullList<CommentsResponse>({
          filter: pb.filter("group = {:groupId}", { groupId }),
          fields: "id,title",
        })
      : Promise.resolve([]),
    // P2: pass the already-resolved session/access to avoid a second
    // getSession() + resolveCircleAccess round trip inside getGroupSchedules.
    getGroupSchedules(groupId, session, access),
    // F-2: when reviews are hidden, votes never ship — score/userVote come
    // from this lean query and only the scalars are forwarded to the client.
    // (`user` is the bare record id needed to resolve the viewer's own vote.)
    !canViewReviews && needsTitles
      ? pb.collection("votes").getFullList<LeanVoteRow>({
          filter: pb.filter("title.group = {:groupId}", { groupId }),
          fields: "value,title,user",
        })
      : Promise.resolve([]),
    // H1: the current member's own review bodies for the ReviewForm prefill,
    // fetched separately so the main title fetch stays free of 5KB bodies.
    canViewReviews && session?.id && needsTitles
      ? pb.collection("reviews").getFullList<ReviewsResponse>({
          filter: pb.filter("user = {:userId} && title.group = {:groupId}", {
            userId: session.id,
            groupId,
          }),
          fields: "id,title,reviewText",
        })
      : Promise.resolve([]),
    // R-runtime: reviews and their reviewer identities are attached via a lean
    // query on the `reviews` collection (dot-filter + expand=user + top-level
    // field projection) — a nested `reviews_via_title.user` expand on the
    // titles query does NOT project in PocketBase 0.39 (bare id, no
    // `.expand.user`). expand.user arrives already trimmed to id/name/avatarUrl
    // so emails never reach the server-side payload, and bodies stay excluded.
    canViewReviews && needsTitles
      ? pb
          .collection("reviews")
          .getFullList<ReviewsResponse<{ user?: UsersResponse }>>({
            filter: pb.filter("title.group = {:groupId}", { groupId }),
            expand: "user",
            fields:
              "id,title,user,rating,createdAt," +
              "expand.user.id,expand.user.name,expand.user.avatarUrl",
          })
      : Promise.resolve([]),
    // Member progress for 3-section lifecycle: fetch active reading/watching
    // records for members linked to group titles.
    needsTitles
      ? pb
          .collection("user_media_progress")
          .getFullList<UserMediaProgressResponse>({
            filter: pb.filter(
              "groupTitle.group = {:groupId} && (status = 'in_progress' || status = 'completed')",
              { groupId },
            ),
            fields: "id,user,groupTitle,status,progressCurrent,progressTotal,progressUnit,updatedAt",
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const memberIds = members.map((m) => m.user);
  const memberProgressByTitle = new Map<string, MemberTitleProgress[]>();
  for (const p of memberProgressRows) {
    if (!p.groupTitle) continue;
    const list = memberProgressByTitle.get(p.groupTitle) ?? [];
    list.push({
      userId: p.user,
      status: p.status as "in_progress" | "completed",
      progressCurrent: p.progressCurrent,
      progressTotal: p.progressTotal,
      progressUnit: p.progressUnit,
      updatedAt: p.updatedAt,
    });
    memberProgressByTitle.set(p.groupTitle, list);
  }

  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.title] = (commentCounts[c.title] ?? 0) + 1;
  }

  const currentMember = session?.id
    ? members.find((m) => m.user === session.id)
    : undefined;
  const currentUserRole = currentMember?.role;

  const ownReviewTextByTitle = new Map<string, string>();
  for (const r of ownReviewRows) {
    if (r.reviewText && r.title) ownReviewTextByTitle.set(r.title, r.reviewText);
  }

  const leanVotesByTitle = new Map<string, LeanVoteRow[]>();
  for (const v of leanVoteRows) {
    const rows = leanVotesByTitle.get(v.title) ?? [];
    rows.push(v);
    leanVotesByTitle.set(v.title, rows);
  }

  const leanReviewsByTitle = new Map<
    string,
    ReviewsResponse<{ user?: UsersResponse }>[]
  >();
  for (const r of leanReviewRows) {
    const rows = leanReviewsByTitle.get(r.title) ?? [];
    rows.push(r);
    leanReviewsByTitle.set(r.title, rows);
  }

  // H1: keeps the current member's own reviewText (ReviewForm prefill) and
  // strips everyone else's (see mapGroupReviewRow); F-2: when reviews are
  // hidden this never ships votes/reviews — only the computed score/userVote.
  const withScore = groupTitles.map((title) =>
    buildTitlePayload(title, {
      canViewReviews,
      currentUserId: session?.id,
      leanVotesByTitle,
      leanReviewsByTitle,
      ownReviewTextByTitle,
    }),
  );

  const isOwnerOrAdmin = currentUserRole === "owner" || Boolean(session?.isAdmin);

  const categorized = categorizeCircleTitles(
    withScore,
    memberProgressByTitle,
    memberIds,
    session?.id,
  );

  const rawProposed = access.canViewBacklog
    ? categorized.proposed.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];
  const proposed = redactProposedTitles(
    rawProposed,
    group.isBlindPickEnabled,
    isOwnerOrAdmin,
  ) as TitleWithProgress[];

  const inProgress = access.canViewBacklog || access.canViewFinished
    ? (categorized.inProgress.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ) as TitleWithProgress[])
    : [];

  const consumed = access.canViewFinished
    ? (categorized.consumed.sort(
        (a, b) =>
          new Date(b.consumedAt || b.createdAt).getTime() -
          new Date(a.consumedAt || a.createdAt).getTime(),
      ) as TitleWithProgress[])
    : [];

  const currentUser = session
    ? {
        id: session.id,
        email: session.email,
        name: session.name,
        avatarUrl: session.avatarUrl,
        isAdmin: session.isAdmin,
      }
    : null;

  async function handleVote(titleId: string, value: "up" | "down") {
    "use server";
    return await voteOnTitle(titleId, groupId, value);
  }

  async function handleStartConsuming(titleId: string) {
    "use server";
    return await startConsuming(titleId, groupId);
  }

  async function handleMarkConsumed(titleId: string) {
    "use server";
    return await markConsumed(titleId, groupId);
  }

  async function handleUnmarkConsumed(titleId: string) {
    "use server";
    return await unmarkConsumed(titleId, groupId);
  }

  async function handleSubmitReview(titleId: string, formData: FormData) {
    "use server";
    return await submitReview(titleId, groupId, formData);
  }

  async function handleAddComment(titleId: string, formData: FormData) {
    "use server";
    return await addComment(titleId, groupId, formData);
  }

  async function handleDeleteComment(commentId: string) {
    "use server";
    return await deleteComment(commentId, groupId);
  }

  async function handleGetComments(titleId: string) {
    "use server";
    return await getComments(titleId, groupId);
  }

  return (
    <AppShell
      user={currentUser}
      maxWidth="wide"
      backHref={access.isGuest ? "/" : "/groups"}
      backLabel={access.isGuest ? t.common.appName : t.groups.allCircles}
      headerActions={
        !access.isGuest ? (
          <Link
            href={`/groups/${groupId}/settings`}
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className: "text-muted-foreground",
            })}
          >
            <Settings className="size-4" />
          </Link>
        ) : null
      }
    >
      <div className="flex flex-col gap-6">
        {/* Guest Viewing Notice Banner */}
        {access.isGuest && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-sm bg-primary/10 border border-primary/20 text-foreground">
            <div className="flex items-center gap-2.5">
              <Globe className="size-4 text-primary shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                {t.guestManagement.guestBannerNotice}
              </p>
            </div>
            <Link
              href={`/invite?code=${group.inviteCode}`}
              className={buttonVariants({
                variant: "default",
                size: "sm",
                className: "shrink-0 gap-1.5 font-semibold text-xs",
              })}
            >
              <UserPlus className="size-3.5" />
              <span>{t.guestManagement.guestBannerJoin}</span>
            </Link>
          </div>
        )}

        {/* Group Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {group.name}
              </h1>
              <CopyInviteButton code={group.inviteCode} />
            </div>
            <p className="text-xs text-muted-foreground">
              {members.length} {t.groups.members}
              {access.canViewBacklog && ` · ${proposed.length} ${t.groups.pendingCountLabel}`}
              {(access.canViewBacklog || access.canViewFinished) && ` · ${inProgress.length} ${t.groups.inProgressCountLabel}`}
              {access.canViewFinished && ` · ${consumed.length} ${t.groups.finishedCountLabel}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {access.canPropose && (
              <AddTitleDialog groupId={groupId} groupName={group.name} />
            )}

            {!access.isGuest && (
              <Link
                href={`/groups/${groupId}/settings`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5 text-muted-foreground hover:text-foreground",
                })}
              >
                <Settings className="size-4" />
                <span className="hidden sm:inline">{t.groups.settings}</span>
              </Link>
            )}

            {access.isGuest && (
              <Link
                href={`/invite?code=${group.inviteCode}`}
                className={buttonVariants({
                  variant: "default",
                  size: "sm",
                  className: "gap-1.5 font-semibold",
                })}
              >
                <UserPlus className="size-4" />
                <span>{t.guestManagement.guestBannerJoin}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Group Content Tabs & List */}
        <GroupContentView
          group={group}
          members={members}
          proposed={proposed}
          inProgress={inProgress}
          consumed={consumed}
          schedules={schedules}
          currentUserId={session?.id ?? ""}
          currentUserRole={currentUserRole}
          isAdmin={session?.isAdmin}
          currentUserName={currentUser?.name}
          currentUserEmail={currentUser?.email}
          currentUserAvatarUrl={currentUser?.avatarUrl}
          commentCounts={commentCounts}
          isGuest={access.isGuest}
          canViewBacklog={access.canViewBacklog}
          canViewFinished={access.canViewFinished}
          canViewReviews={access.canViewReviews}
          canViewComments={access.canViewComments}
          canVote={access.canVote}
          canComment={access.canComment}
          canReview={access.canReview}
          canPropose={access.canPropose}
          onVote={handleVote}
          onStartConsuming={handleStartConsuming}
          onMarkConsumed={handleMarkConsumed}
          onUnmarkConsumed={handleUnmarkConsumed}
          onSubmitReview={handleSubmitReview}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onFetchComments={handleGetComments}
        />

        {/* Floating Action Button (Bottom Right FAB - Propose Media) */}
        {access.canPropose && (
          <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 sm:right-8 z-40">
            <AddTitleDialog
              groupId={groupId}
              groupName={group.name}
              trigger={
                <button
                  type="button"
                  className="group flex items-center gap-2 px-3.5 py-2.5 sm:px-5 sm:py-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring cursor-pointer"
                  aria-label={t.groups.proposeMedia}
                >
                  <Plus className="size-4 sm:size-5 transition-transform group-hover:rotate-90" />
                  <span>{t.groups.proposeMedia}</span>
                </button>
              }
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
