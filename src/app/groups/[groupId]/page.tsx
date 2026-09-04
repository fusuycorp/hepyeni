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
import { getSession } from "@/lib/pocketbase/session";
import { getServerTranslations } from "@/lib/i18n/server";
import { fetchCircleFeed } from "@/lib/queries/circle-feed";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  const { groupId } = await params;
  const t = await getServerTranslations();

  let feed;
  try {
    feed = await fetchCircleFeed(groupId, session);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCESS_DENIED") {
      if (!session) redirect("/login");
      notFound();
    }
    notFound();
  }

  const {
    access,
    group,
    members,
    proposed,
    inProgress,
    consumed,
    commentCounts,
    schedules,
    currentUserRole,
  } = feed;

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
