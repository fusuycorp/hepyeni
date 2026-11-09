"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, Star, Users, Settings, User, Filter, X, Calendar, Clock, Play, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { VoteControl } from "@/components/vote-control";
import { MarkConsumedButton } from "@/components/mark-consumed-button";
import { ReviewForm } from "@/components/review-form";
import { MediaComments } from "@/components/media-comments";
import { EmptyState } from "@/components/empty-state";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { GroupSchedulesCard } from "@/components/group-schedules-card";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MEDIA_TYPES } from "@/lib/media-types";
import { getDisplayName, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import { useFeatureFlag } from "@/lib/flags/client";
import { DecisionWheelDialog } from "@/components/decision-wheel-dialog";
import { MOODS, MOOD_DETAILS, type MoodType } from "@/lib/moods";
import type { PublicUser, TitlePayload, TitleWithProgress } from "@/lib/group-titles";
import type { ActionResult } from "@/types/actions";
import type { PublicComment } from "@/lib/comments";
import type { GroupScheduleWithMilestones } from "@/lib/actions/schedules";
import type {
  GroupMembersResponse,
  GroupsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

type TitleWithScore = (TitlePayload | TitleWithProgress) & {
  moods?: MoodType[] | null;
  pace?: string | null;
  progressSummary?: TitleWithProgress["progressSummary"];
};

interface GroupContentViewProps {
  group: GroupsResponse;
  members: GroupMembersResponse<{ user?: PublicUser | UsersResponse }>[];
  proposed: TitleWithScore[];
  inProgress?: TitleWithScore[];
  consumed: TitleWithScore[];
  schedules?: GroupScheduleWithMilestones[];
  currentUserId?: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  commentCounts: Record<string, number>;
  isGuest?: boolean;
  canViewBacklog?: boolean;
  canViewFinished?: boolean;
  canViewReviews?: boolean;
  canViewComments?: boolean;
  canVote?: boolean;
  canComment?: boolean;
  canReview?: boolean;
  canPropose?: boolean;
  onVote: (titleId: string, value: "up" | "down") => Promise<ActionResult<void> | void>;
  onStartConsuming?: (titleId: string) => Promise<ActionResult<void> | void>;
  onMarkConsumed: (titleId: string) => Promise<ActionResult<void> | void>;
  onUnmarkConsumed: (titleId: string) => Promise<ActionResult<void> | void>;
  onSubmitReview: (titleId: string, formData: FormData) => Promise<ActionResult<void> | void>;
  onAddComment?: (
    titleId: string,
    formData: FormData,
  ) => Promise<ActionResult<PublicComment> | PublicComment>;
  onDeleteComment?: (commentId: string) => Promise<ActionResult<void> | void>;
  onFetchComments?: (titleId: string) => Promise<PublicComment[]>;
}

type GroupTab = "proposed" | "in_progress" | "consumed" | "schedules";

interface CommentActionBundle {
  commentCounts: Record<string, number>;
  currentUserId: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  canViewComments: boolean;
  canComment: boolean;
  onAddComment?: GroupContentViewProps["onAddComment"];
  onDeleteComment?: GroupContentViewProps["onDeleteComment"];
  onFetchComments?: GroupContentViewProps["onFetchComments"];
}

function getTitleMoodList(item: TitleWithScore): MoodType[] {
  const rawMoods =
    (Array.isArray(item.moods)
      ? item.moods
      : (item.metadata?.moods as MoodType[] | undefined)) ?? [];
  if (!Array.isArray(rawMoods)) return [];
  return rawMoods.filter((x): x is MoodType => typeof x === "string" && x in MOOD_DETAILS);
}

function TitleMoodBadges({
  title,
  enabled,
}: {
  title: TitleWithScore;
  enabled: boolean;
}) {
  const t = useTranslations();
  if (!enabled) return null;
  const itemMoods = getTitleMoodList(title);
  if (itemMoods.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {itemMoods.map((m) => {
        const detail = MOOD_DETAILS[m];
        return (
          <span
            key={m}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full font-medium border",
              detail?.bgColor || "bg-muted",
              detail?.borderColor || "border-border",
              detail?.color || "text-foreground",
            )}
          >
            <span>{detail?.emoji}</span>
            <span>{t.moods[m] || m}</span>
          </span>
        );
      })}
    </div>
  );
}

function TitleCommentsTrigger({
  title,
  groupId,
  bundle,
}: {
  title: TitleWithScore;
  groupId: string;
  bundle: CommentActionBundle;
}) {
  if (!bundle.canViewComments) return null;
  return (
    <MediaComments
      titleId={title.id}
      groupId={groupId}
      titleName={title.title}
      initialCount={bundle.commentCounts[title.id] ?? 0}
      currentUserId={bundle.currentUserId}
      currentUserRole={bundle.currentUserRole}
      isAdmin={bundle.isAdmin}
      currentUserName={bundle.currentUserName}
      currentUserEmail={bundle.currentUserEmail}
      currentUserAvatarUrl={bundle.currentUserAvatarUrl}
      canComment={bundle.canComment}
      onAddComment={bundle.onAddComment}
      onDeleteComment={bundle.onDeleteComment}
      onFetchComments={bundle.onFetchComments}
    />
  );
}

function ProposedTitleCard({
  title,
  index,
  groupId,
  canVote,
  isGuest,
  moodFeatureEnabled,
  commentBundle,
  onVote,
  onStartConsuming,
  onMarkConsumed,
}: {
  title: TitleWithScore;
  index: number;
  groupId: string;
  canVote: boolean;
  isGuest: boolean;
  moodFeatureEnabled: boolean;
  commentBundle: CommentActionBundle;
  onVote: GroupContentViewProps["onVote"];
  onStartConsuming?: GroupContentViewProps["onStartConsuming"];
  onMarkConsumed: GroupContentViewProps["onMarkConsumed"];
}) {
  const t = useTranslations();
  const addedByLabel = title.expand?.addedBy
    ? getDisplayName(title.expand.addedBy, t.common.unnamedUser)
    : t.blindPick.anonymousRecommender;

  return (
    <Card className="border-border/70 shadow-xs hover:border-border transition-all duration-200">
      <CardContent className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 flex flex-col items-center">
          <VoteControl
            score={title.score}
            userVote={title.userVote}
            disabled={!canVote}
            onVote={canVote ? (val) => onVote(title.id, val) : undefined}
          />
        </div>

        <Link
          href={`/groups/${groupId}/titles/${title.id}`}
          className="shrink-0 transition-transform hover:scale-105"
          aria-label={title.title}
        >
          <MediaCover
            src={title.coverUrl}
            alt={title.title}
            size="md"
            className="rounded-lg shadow-xs"
          />
        </Link>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <MediaBadge type={title.mediaType} size="sm" />
            {index === 0 && title.score > 0 && (
              <Badge
                variant="default"
                className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
              >
                {t.media.topPick}
              </Badge>
            )}
          </div>

          <div>
            <Link href={`/groups/${groupId}/titles/${title.id}`} className="group/title inline-block">
              <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2 group-hover/title:text-primary transition-colors">
                {title.title}
              </h3>
            </Link>
            {title.creator && (
              <p className="text-xs text-muted-foreground font-medium line-clamp-1 mt-0.5">
                {title.creator}
              </p>
            )}
            <TitleMoodBadges title={title} enabled={moodFeatureEnabled} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {t.media.addedBy}:{" "}
              <span className="font-medium text-foreground">{addedByLabel}</span>
            </p>
            <div className="flex items-center gap-2">
              <TitleCommentsTrigger title={title} groupId={groupId} bundle={commentBundle} />
              {!isGuest && (
                <div className="flex flex-col items-end gap-1.5">
                  {onStartConsuming && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onStartConsuming(title.id)}
                    >
                      <Play className="size-3 text-amber-500 fill-amber-500/20 shrink-0" />
                      <span>{t.media.startConsuming}</span>
                    </Button>
                  )}
                  <MarkConsumedButton
                    variant="outline"
                    size="sm"
                    showIcon={true}
                    className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onMark={() => onMarkConsumed(title.id)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InProgressStatusBadges({
  title,
  memberCount,
}: {
  title: TitleWithScore;
  memberCount: number;
}) {
  const t = useTranslations();
  const userStatus = title.progressSummary?.currentUserStatus ?? "not_started";
  const finishedCount = title.progressSummary?.finishedCount ?? 0;
  const totalMembers = title.progressSummary?.totalMembers ?? memberCount;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MediaBadge type={title.mediaType} size="sm" />
      <Badge
        variant="outline"
        className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1"
      >
        <Clock className="size-2.5" />
        <span>
          {finishedCount}/{totalMembers} {t.media.membersFinished}
        </span>
      </Badge>
      {userStatus === "completed" && (
        <Badge
          variant="outline"
          className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        >
          ✓ {t.media.youFinished}
        </Badge>
      )}
      {userStatus === "in_progress" && (
        <Badge
          variant="outline"
          className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
        >
          {t.media.youInProgress}
        </Badge>
      )}
    </div>
  );
}

function InProgressActionButtons({
  titleId,
  userStatus,
  isGuest,
  onStartConsuming,
  onMarkConsumed,
}: {
  titleId: string;
  userStatus: string;
  isGuest: boolean;
  onStartConsuming?: GroupContentViewProps["onStartConsuming"];
  onMarkConsumed: GroupContentViewProps["onMarkConsumed"];
}) {
  const t = useTranslations();
  if (isGuest) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {userStatus === "not_started" && onStartConsuming && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onStartConsuming(titleId)}
        >
          <Play className="size-3 text-amber-500 fill-amber-500/20 shrink-0" />
          <span>{t.media.startConsuming}</span>
        </Button>
      )}
      {userStatus !== "completed" && (
        <MarkConsumedButton
          variant="outline"
          size="sm"
          showIcon={true}
          className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onMark={() => onMarkConsumed(titleId)}
        />
      )}
    </div>
  );
}

function InProgressTitleCard({
  title,
  groupId,
  memberCount,
  canVote,
  isGuest,
  commentBundle,
  onVote,
  onStartConsuming,
  onMarkConsumed,
}: {
  title: TitleWithScore;
  groupId: string;
  memberCount: number;
  canVote: boolean;
  isGuest: boolean;
  commentBundle: CommentActionBundle;
  onVote: GroupContentViewProps["onVote"];
  onStartConsuming?: GroupContentViewProps["onStartConsuming"];
  onMarkConsumed: GroupContentViewProps["onMarkConsumed"];
}) {
  const t = useTranslations();
  const userStatus = title.progressSummary?.currentUserStatus ?? "not_started";
  const addedByLabel = title.expand?.addedBy
    ? getDisplayName(title.expand.addedBy, t.common.unnamedUser)
    : t.blindPick.anonymousRecommender;

  return (
    <Card className="border-border/70 shadow-xs hover:border-border transition-all duration-200">
      <CardContent className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 flex flex-col items-center">
          <VoteControl
            score={title.score}
            userVote={title.userVote}
            disabled={!canVote}
            onVote={canVote ? (val) => onVote(title.id, val) : undefined}
          />
        </div>

        <Link
          href={`/groups/${groupId}/titles/${title.id}`}
          className="shrink-0 transition-transform hover:scale-105"
          aria-label={title.title}
        >
          <MediaCover
            src={title.coverUrl}
            alt={title.title}
            size="md"
            className="rounded-lg shadow-xs"
          />
        </Link>

        <div className="flex-1 min-w-0 space-y-1.5">
          <InProgressStatusBadges title={title} memberCount={memberCount} />

          <div>
            <Link href={`/groups/${groupId}/titles/${title.id}`} className="group/title inline-block">
              <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2 group-hover/title:text-primary transition-colors">
                {title.title}
              </h3>
            </Link>
            {title.creator && (
              <p className="text-xs text-muted-foreground font-medium line-clamp-1 mt-0.5">
                {title.creator}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {t.media.addedBy}:{" "}
              <span className="font-medium text-foreground">{addedByLabel}</span>
            </p>
            <div className="flex items-center gap-2">
              <TitleCommentsTrigger title={title} groupId={groupId} bundle={commentBundle} />
              <InProgressActionButtons
                titleId={title.id}
                userStatus={userStatus}
                isGuest={isGuest}
                onStartConsuming={onStartConsuming}
                onMarkConsumed={onMarkConsumed}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConsumedOtherReviewsList({
  otherReviews,
  groupId,
  titleId,
  canViewReviews,
}: {
  otherReviews: NonNullable<TitleWithScore["expand"]>["reviews_via_title"];
  groupId: string;
  titleId: string;
  canViewReviews: boolean;
}) {
  const t = useTranslations();
  if (!canViewReviews || !otherReviews || otherReviews.length === 0) return null;

  return (
    <div className="space-y-2 pt-2 border-t">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t.reviews.groupReviews} ({otherReviews.length})
      </p>
      <div className="space-y-2">
        {otherReviews.map((r) => (
          <div
            key={r.id}
            className="p-3 rounded-lg bg-card border border-border/40 text-xs space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {getDisplayName(r.expand?.user, t.common.unnamedUser)}
              </span>
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="size-3 fill-amber-400" />
                ))}
              </div>
            </div>
            {/* H1: other users' reviewText never ships on
                this page. Note the body on the linked
                title-detail page is also own-body-only
                (mapGroupReviewRow strips everyone
                else's), so no surface exposes another
                member's full review body. */}
            <Link
              href={`/groups/${groupId}/titles/${titleId}`}
              className="inline-flex items-center text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              {t.media.viewDetails}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsumedMyReviewBox({
  canReview,
  myReview,
  titleId,
  onSubmitReview,
}: {
  canReview: boolean;
  myReview: NonNullable<TitleWithScore["expand"]>["reviews_via_title"] extends
    | Array<infer R>
    | undefined
    ? R | undefined
    : never;
  titleId: string;
  onSubmitReview: GroupContentViewProps["onSubmitReview"];
}) {
  const t = useTranslations();
  if (!canReview) return null;
  return (
    <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
      <p className="text-xs font-semibold text-foreground mb-2">
        {myReview ? t.reviews.yourRatingAndReview : t.reviews.rateThisTitle}
      </p>
      <ReviewForm
        defaultRating={myReview?.rating ?? 5}
        defaultText={myReview?.reviewText ?? ""}
        hasExisting={Boolean(myReview)}
        onSubmit={(formData) => onSubmitReview(titleId, formData)}
      />
    </div>
  );
}

function ConsumedTitleCard({
  title,
  groupId,
  canViewReviews,
  canReview,
  isGuest,
  commentBundle,
  onUnmarkConsumed,
  onSubmitReview,
}: {
  title: TitleWithScore;
  groupId: string;
  canViewReviews: boolean;
  canReview: boolean;
  isGuest: boolean;
  commentBundle: CommentActionBundle;
  onUnmarkConsumed: GroupContentViewProps["onUnmarkConsumed"];
  onSubmitReview: GroupContentViewProps["onSubmitReview"];
}) {
  const t = useTranslations();
  const reviews = title.expand?.reviews_via_title ?? [];
  const avg = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : null;
  const myReview = reviews.find((r) => r.user === commentBundle.currentUserId);
  const otherReviews = reviews.filter((r) => r.user !== commentBundle.currentUserId);

  return (
    <Card className="border-border/70 shadow-xs hover:border-border transition-all duration-200 overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <Link
              href={`/groups/${groupId}/titles/${title.id}`}
              className="shrink-0 transition-transform hover:scale-105"
              aria-label={title.title}
            >
              <MediaCover
                src={title.coverUrl}
                alt={title.title}
                size="md"
                className="rounded-lg shadow-xs"
              />
            </Link>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <MediaBadge type={title.mediaType} size="sm" />
                {avg !== null && canViewReviews && (
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    <span>{avg.toFixed(1)}</span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      ({reviews.length} {t.media.reviewsCount})
                    </span>
                  </div>
                )}
              </div>
              <Link href={`/groups/${groupId}/titles/${title.id}`} className="group/title inline-block">
                <h3 className="text-base font-semibold text-foreground tracking-tight leading-snug group-hover/title:text-primary transition-colors">
                  {title.title}
                </h3>
              </Link>
              {title.creator && (
                <p className="text-xs text-muted-foreground">{title.creator}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <TitleCommentsTrigger title={title} groupId={groupId} bundle={commentBundle} />
            {!isGuest && (
              <MarkConsumedButton
                direction="unconsume"
                variant="outline"
                size="sm"
                showIcon={true}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onMark={() => onUnmarkConsumed(title.id)}
              />
            )}
          </div>
        </div>

        <ConsumedMyReviewBox
          canReview={canReview}
          myReview={myReview}
          titleId={title.id}
          onSubmitReview={onSubmitReview}
        />

        <ConsumedOtherReviewsList
          otherReviews={otherReviews}
          groupId={groupId}
          titleId={title.id}
          canViewReviews={canViewReviews}
        />
      </CardContent>
    </Card>
  );
}

function GroupMembersSidebar({
  groupId,
  members,
  isGuest,
}: {
  groupId: string;
  members: GroupContentViewProps["members"];
  isGuest: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.groups.members} ({members.length})
              </h3>
            </div>
            {!isGuest && (
              <Link
                href={`/groups/${groupId}/settings`}
                className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
              >
                <Settings className="size-3.5" />
                <span>{t.common.manage}</span>
              </Link>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {members.map((m) => {
              const user = m.expand?.user;
              const userName = getDisplayName(user, t.common.unnamedUser);
              const userEmail =
                user && "email" in user ? (user.email as string | undefined) : undefined;
              const initials = getInitials(user?.name, userEmail);
              const isOwner = m.role === "owner";

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar size="sm" className="ring-1 ring-border">
                      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={userName} />}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">
                        {userName}
                      </span>
                      {userEmail && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {userEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] uppercase tracking-wider font-semibold py-0"
                    >
                      {t.groups.ownerBadge}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupTabButton({
  id,
  controls,
  selected,
  onClick,
  icon,
  label,
  count,
  activeBadgeClass,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number | null;
  activeBadgeClass: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xs text-xs font-medium transition-all min-h-[32px] sm:min-h-0 shrink-0",
        selected
          ? "bg-background text-foreground shadow-2xs font-semibold"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== null && (
        <span
          className={cn(
            "px-1.5 py-0.2 rounded-xs font-mono text-[10px]",
            selected ? activeBadgeClass : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function GroupTabSwitcher({
  activeTab,
  setActiveTab,
  canViewBacklog,
  canViewFinished,
  proposedCount,
  inProgressCount,
  consumedCount,
  schedulesCount,
}: {
  activeTab: GroupTab;
  setActiveTab: (tab: GroupTab) => void;
  canViewBacklog: boolean;
  canViewFinished: boolean;
  proposedCount: number;
  inProgressCount: number;
  consumedCount: number;
  schedulesCount: number;
}) {
  const t = useTranslations();
  if (!canViewBacklog && !canViewFinished) return null;

  return (
    <div
      role="tablist"
      aria-label={t.groups.contentViewAria}
      className="flex items-center gap-1 bg-muted/60 p-1 rounded-sm border border-border/60 w-fit overflow-x-auto scrollbar-none overscroll-x-contain touch-pan-x max-w-full"
    >
      {canViewBacklog && (
        <GroupTabButton
          id="proposed-tab"
          controls="proposed-panel"
          selected={activeTab === "proposed"}
          onClick={() => setActiveTab("proposed")}
          icon={<Sparkles className="size-3.5 text-primary" />}
          label={t.media.upNext}
          count={proposedCount}
          activeBadgeClass="bg-primary/10 text-primary font-semibold"
        />
      )}

      <GroupTabButton
        id="in-progress-tab"
        controls="in-progress-panel"
        selected={activeTab === "in_progress"}
        onClick={() => setActiveTab("in_progress")}
        icon={<Clock className="size-3.5 text-amber-500" />}
        label={t.media.inProgress}
        count={inProgressCount}
        activeBadgeClass="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
      />

      {canViewFinished && (
        <GroupTabButton
          id="consumed-tab"
          controls="consumed-panel"
          selected={activeTab === "consumed"}
          onClick={() => setActiveTab("consumed")}
          icon={<CheckCircle2 className="size-3.5 text-emerald-500" />}
          label={t.media.finished}
          count={consumedCount}
          activeBadgeClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
        />
      )}

      <GroupTabButton
        id="schedules-tab"
        controls="schedules-panel"
        selected={activeTab === "schedules"}
        onClick={() => setActiveTab("schedules")}
        icon={<Calendar className="size-3.5 text-primary" />}
        label={t.schedules.schedulesTitle}
        count={schedulesCount > 0 ? schedulesCount : null}
        activeBadgeClass="bg-primary/10 text-primary font-semibold"
      />
    </div>
  );
}

function GroupMediaTypeFilterRow({
  selectedMediaType,
  setSelectedMediaType,
  showWheel,
  proposed,
  group,
}: {
  selectedMediaType: string;
  setSelectedMediaType: (val: string) => void;
  showWheel: boolean;
  proposed: TitleWithScore[];
  group: GroupsResponse;
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none overscroll-x-contain touch-pan-x flex-nowrap">
      <button
        type="button"
        aria-pressed={selectedMediaType === "all"}
        onClick={() => setSelectedMediaType("all")}
        className={cn(
          "px-2.5 py-1 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap min-h-[30px] sm:min-h-0",
          selectedMediaType === "all"
            ? "bg-foreground text-background border-foreground font-semibold"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        {t.media.allTypes}
      </button>
      {MEDIA_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={selectedMediaType === type}
          onClick={() => setSelectedMediaType(type)}
          className={cn(
            "px-2.5 py-1 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap flex items-center gap-1 min-h-[30px] sm:min-h-0",
            selectedMediaType === type
              ? "bg-foreground text-background border-foreground font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          <MediaBadge
            type={type}
            size="sm"
            showIcon={false}
            className="border-0 bg-transparent p-0"
          />
        </button>
      ))}

      {showWheel && (
        <div className="ml-auto pl-2">
          <DecisionWheelDialog
            items={proposed}
            groupId={group.id}
            groupName={group.name}
          />
        </div>
      )}
    </div>
  );
}

function GroupRecommenderFilterRow({
  selectedRecommender,
  setSelectedRecommender,
  recommendersList,
  currentUserId,
  isFiltered,
  onClearFilters,
}: {
  selectedRecommender: string;
  setSelectedRecommender: (val: string) => void;
  recommendersList: Array<{ id: string; name: string; avatarUrl?: string; count: number }>;
  currentUserId: string;
  isFiltered: boolean;
  onClearFilters: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none overscroll-x-contain touch-pan-x flex-nowrap text-xs pt-1">
      <div className="flex items-center gap-1 text-muted-foreground font-medium shrink-0 pr-1">
        <User className="size-3.5" />
        <span className="hidden sm:inline">{t.groups.recommenderLabel}:</span>
      </div>

      <button
        type="button"
        aria-pressed={selectedRecommender === "all"}
        onClick={() => setSelectedRecommender("all")}
        className={cn(
          "px-2.5 py-1 sm:py-0.5 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-0",
          selectedRecommender === "all"
            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {t.groups.allRecommenders}
      </button>

      {recommendersList.map((rec) => {
        const isMe = rec.id === currentUserId;
        const isSelected =
          selectedRecommender === rec.id || (isMe && selectedRecommender === "me");
        return (
          <button
            key={rec.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => setSelectedRecommender(isSelected ? "all" : rec.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-0.5 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-0",
              isSelected
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{isMe ? t.groups.myRecommendations : rec.name}</span>
            {rec.count > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-xs font-mono text-[10px]",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {rec.count}
              </span>
            )}
          </button>
        );
      })}

      {isFiltered && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 px-2 py-1 sm:py-0.5 rounded-xs text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap ml-auto min-h-[28px] sm:min-h-0"
        >
          <X className="size-3" />
          <span>{t.groups.clearFilters}</span>
        </button>
      )}
    </div>
  );
}

function GroupMoodFilterRow({
  moodFeatureEnabled,
  selectedMood,
  setSelectedMood,
}: {
  moodFeatureEnabled: boolean;
  selectedMood: string;
  setSelectedMood: (val: string) => void;
}) {
  const t = useTranslations();
  if (!moodFeatureEnabled) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none overscroll-x-contain touch-pan-x flex-nowrap text-xs pt-1 border-t border-border/60">
      <div className="flex items-center gap-1 text-muted-foreground font-medium shrink-0 pr-1">
        <Smile className="size-3.5" />
        <span className="hidden sm:inline">{t.moods.filterByMood}:</span>
      </div>

      <button
        type="button"
        aria-pressed={selectedMood === "all"}
        onClick={() => setSelectedMood("all")}
        className={cn(
          "px-2.5 py-1 sm:py-0.5 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-0",
          selectedMood === "all"
            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {t.moods.allMoods}
      </button>

      {MOODS.map((mood) => {
        const isSelected = selectedMood === mood;
        const detail = MOOD_DETAILS[mood];
        return (
          <button
            key={mood}
            type="button"
            aria-pressed={isSelected}
            onClick={() => setSelectedMood(isSelected ? "all" : mood)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 sm:py-0.5 rounded-xs text-xs font-medium border border-border/60 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-0",
              isSelected
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                : cn(
                    "bg-background text-muted-foreground hover:text-foreground",
                    detail?.bgColor,
                  ),
            )}
          >
            <span>{detail?.emoji}</span>
            <span>{t.moods[mood]}</span>
          </button>
        );
      })}
    </div>
  );
}

function GroupFilterToolbar({
  group,
  activeTab,
  setActiveTab,
  canViewBacklog,
  canViewFinished,
  proposed,
  inProgress,
  consumed,
  schedules,
  selectedMediaType,
  setSelectedMediaType,
  selectedRecommender,
  setSelectedRecommender,
  selectedMood,
  setSelectedMood,
  recommendersList,
  currentUserId,
  isFiltered,
  moodFeatureEnabled,
  wheelFeatureEnabled,
  onClearFilters,
}: {
  group: GroupsResponse;
  activeTab: GroupTab;
  setActiveTab: (tab: GroupTab) => void;
  canViewBacklog: boolean;
  canViewFinished: boolean;
  proposed: TitleWithScore[];
  inProgress: TitleWithScore[];
  consumed: TitleWithScore[];
  schedules: GroupScheduleWithMilestones[];
  selectedMediaType: string;
  setSelectedMediaType: (val: string) => void;
  selectedRecommender: string;
  setSelectedRecommender: (val: string) => void;
  selectedMood: string;
  setSelectedMood: (val: string) => void;
  recommendersList: Array<{ id: string; name: string; avatarUrl?: string; count: number }>;
  currentUserId: string;
  isFiltered: boolean;
  moodFeatureEnabled: boolean;
  wheelFeatureEnabled: boolean;
  onClearFilters: () => void;
}) {
  const showWheel = Boolean(
    wheelFeatureEnabled && canViewBacklog && proposed.length > 0 && activeTab === "proposed",
  );

  return (
    <div className="space-y-3 pb-3 border-b border-border/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <GroupTabSwitcher
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canViewBacklog={canViewBacklog}
          canViewFinished={canViewFinished}
          proposedCount={proposed.length}
          inProgressCount={inProgress.length}
          consumedCount={consumed.length}
          schedulesCount={schedules.length}
        />

        <GroupMediaTypeFilterRow
          selectedMediaType={selectedMediaType}
          setSelectedMediaType={setSelectedMediaType}
          showWheel={showWheel}
          proposed={proposed}
          group={group}
        />
      </div>

      <GroupRecommenderFilterRow
        selectedRecommender={selectedRecommender}
        setSelectedRecommender={setSelectedRecommender}
        recommendersList={recommendersList}
        currentUserId={currentUserId}
        isFiltered={isFiltered}
        onClearFilters={onClearFilters}
      />

      <GroupMoodFilterRow
        moodFeatureEnabled={moodFeatureEnabled}
        selectedMood={selectedMood}
        setSelectedMood={setSelectedMood}
      />
    </div>
  );
}

function matchesTitleFilter(
  item: TitleWithScore,
  selectedMediaType: string,
  selectedRecommender: string,
  currentUserId: string,
  moodFeatureEnabled: boolean,
  selectedMood: string,
): boolean {
  if (selectedMediaType !== "all" && item.mediaType !== selectedMediaType) {
    return false;
  }
  const targetUser = selectedRecommender === "me" ? currentUserId : selectedRecommender;
  if (selectedRecommender !== "all" && item.addedBy !== targetUser) {
    return false;
  }
  if (moodFeatureEnabled && selectedMood !== "all") {
    return getTitleMoodList(item).includes(selectedMood as MoodType);
  }
  return true;
}

function buildRecommendersList(
  members: GroupContentViewProps["members"],
  recommenderCounts: Record<string, number>,
  currentUserId: string,
  unnamedUserLabel: string,
): Array<{ id: string; name: string; avatarUrl?: string; count: number }> {
  const map = new Map<
    string,
    { id: string; name: string; avatarUrl?: string; count: number }
  >();

  for (const m of members) {
    const user = m.expand?.user;
    const userId = m.user;
    const count = recommenderCounts[userId] ?? 0;
    if (count > 0 || userId === currentUserId) {
      map.set(userId, {
        id: userId,
        name: getDisplayName(user, unnamedUserLabel),
        avatarUrl: user?.avatarUrl,
        count,
      });
    }
  }
  return Array.from(map.values());
}

function ProposedTabPanel({
  group,
  filteredProposed,
  isFiltered,
  filteredEmptyTitle,
  canPropose,
  canVote,
  isGuest,
  moodFeatureEnabled,
  commentBundle,
  setSelectedMood,
  onClearFilters,
  onVote,
  onStartConsuming,
  onMarkConsumed,
}: {
  group: GroupsResponse;
  filteredProposed: TitleWithScore[];
  isFiltered: boolean;
  filteredEmptyTitle: string;
  canPropose: boolean;
  canVote: boolean;
  isGuest: boolean;
  moodFeatureEnabled: boolean;
  commentBundle: CommentActionBundle;
  setSelectedMood: (val: string) => void;
  onClearFilters: () => void;
  onVote: GroupContentViewProps["onVote"];
  onStartConsuming?: GroupContentViewProps["onStartConsuming"];
  onMarkConsumed: GroupContentViewProps["onMarkConsumed"];
}) {
  const t = useTranslations();
  const emptyAction = isFiltered ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 gap-1.5 font-medium"
      onClick={() => {
        setSelectedMood("all");
        onClearFilters();
      }}
    >
      <X className="size-3.5" />
      <span>{t.groups.clearFilters}</span>
    </Button>
  ) : canPropose ? (
    <div className="mt-2">
      <AddTitleDialog groupId={group.id} groupName={group.name} />
    </div>
  ) : undefined;

  return (
    <div id="proposed-panel" role="tabpanel" aria-labelledby="proposed-tab">
      {filteredProposed.length > 0 ? (
        <div className="space-y-3">
          {filteredProposed.map((title, index) => (
            <ProposedTitleCard
              key={title.id}
              title={title}
              index={index}
              groupId={group.id}
              canVote={canVote}
              isGuest={isGuest}
              moodFeatureEnabled={moodFeatureEnabled}
              commentBundle={commentBundle}
              onVote={onVote}
              onStartConsuming={onStartConsuming}
              onMarkConsumed={onMarkConsumed}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={isFiltered ? Filter : Sparkles}
          title={isFiltered ? filteredEmptyTitle : t.groups.emptyBacklogTitle}
          description={isFiltered ? t.titles.cantFindMediaDesc : t.groups.emptyBacklogDesc}
          action={emptyAction}
        />
      )}
    </div>
  );
}

function GroupTabPanels({
  activeTab,
  group,
  membersCount,
  filteredProposed,
  filteredInProgress,
  filteredConsumed,
  isFiltered,
  filteredEmptyTitle,
  canPropose,
  canVote,
  canViewReviews,
  canReview,
  isGuest,
  moodFeatureEnabled,
  commentBundle,
  setSelectedMood,
  onClearFilters,
  onVote,
  onStartConsuming,
  onMarkConsumed,
  onUnmarkConsumed,
  onSubmitReview,
}: {
  activeTab: GroupTab;
  group: GroupsResponse;
  membersCount: number;
  filteredProposed: TitleWithScore[];
  filteredInProgress: TitleWithScore[];
  filteredConsumed: TitleWithScore[];
  isFiltered: boolean;
  filteredEmptyTitle: string;
  canPropose: boolean;
  canVote: boolean;
  canViewReviews: boolean;
  canReview: boolean;
  isGuest: boolean;
  moodFeatureEnabled: boolean;
  commentBundle: CommentActionBundle;
  setSelectedMood: (val: string) => void;
  onClearFilters: () => void;
  onVote: GroupContentViewProps["onVote"];
  onStartConsuming?: GroupContentViewProps["onStartConsuming"];
  onMarkConsumed: GroupContentViewProps["onMarkConsumed"];
  onUnmarkConsumed: GroupContentViewProps["onUnmarkConsumed"];
  onSubmitReview: GroupContentViewProps["onSubmitReview"];
}) {
  const t = useTranslations();

  if (activeTab === "proposed") {
    return (
      <ProposedTabPanel
        group={group}
        filteredProposed={filteredProposed}
        isFiltered={isFiltered}
        filteredEmptyTitle={filteredEmptyTitle}
        canPropose={canPropose}
        canVote={canVote}
        isGuest={isGuest}
        moodFeatureEnabled={moodFeatureEnabled}
        commentBundle={commentBundle}
        setSelectedMood={setSelectedMood}
        onClearFilters={onClearFilters}
        onVote={onVote}
        onStartConsuming={onStartConsuming}
        onMarkConsumed={onMarkConsumed}
      />
    );
  }

  if (activeTab === "in_progress") {
    return (
      <div id="in-progress-panel" role="tabpanel" aria-labelledby="in-progress-tab">
        {filteredInProgress.length > 0 ? (
          <div className="space-y-3">
            {filteredInProgress.map((title) => (
              <InProgressTitleCard
                key={title.id}
                title={title}
                groupId={group.id}
                memberCount={membersCount}
                canVote={canVote}
                isGuest={isGuest}
                commentBundle={commentBundle}
                onVote={onVote}
                onStartConsuming={onStartConsuming}
                onMarkConsumed={onMarkConsumed}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Clock}
            title={t.media.emptyInProgressTitle}
            description={t.media.emptyInProgressDesc}
          />
        )}
      </div>
    );
  }

  return (
    <div id="consumed-panel" role="tabpanel" aria-labelledby="consumed-tab">
      {filteredConsumed.length > 0 ? (
        <div className="space-y-4">
          {filteredConsumed.map((title) => (
            <ConsumedTitleCard
              key={title.id}
              title={title}
              groupId={group.id}
              canViewReviews={canViewReviews}
              canReview={canReview}
              isGuest={isGuest}
              commentBundle={commentBundle}
              onUnmarkConsumed={onUnmarkConsumed}
              onSubmitReview={onSubmitReview}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={isFiltered ? Filter : CheckCircle2}
          title={isFiltered ? filteredEmptyTitle : t.groups.emptyFinishedTitle}
          description={isFiltered ? t.titles.cantFindMediaDesc : t.groups.emptyFinishedDesc}
          action={
            isFiltered ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5 font-medium"
                onClick={() => {
                  setSelectedMood("all");
                  onClearFilters();
                }}
              >
                <X className="size-3.5" />
                <span>{t.groups.clearFilters}</span>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function resolveFilteredEmptyTitle(
  selectedRecommender: string,
  selectedMediaType: string,
  recommendersList: Array<{ id: string; name: string }>,
  t: ReturnType<typeof useTranslations>,
): string {
  if (selectedRecommender !== "all") {
    const selectedMemberName =
      selectedRecommender === "me"
        ? t.groups.myRecommendations
        : recommendersList.find((r) => r.id === selectedRecommender)?.name ??
          t.groups.allRecommenders;
    return t.groups.noRecommendationsFilter.replace("{name}", selectedMemberName);
  }
  const typeLabel = t.media[selectedMediaType as keyof typeof t.media] ?? selectedMediaType;
  return t.groups.emptyBacklogFilteredTitle.replace("{type}", typeLabel);
}

function resolveGroupContentCollections(props: GroupContentViewProps) {
  return {
    inProgress: props.inProgress ?? [],
    schedules: props.schedules ?? [],
    currentUserId: props.currentUserId ?? "",
    isGuest: props.isGuest ?? false,
  };
}

function resolveGroupContentPermissions(props: GroupContentViewProps) {
  return {
    canViewBacklog: props.canViewBacklog ?? true,
    canViewFinished: props.canViewFinished ?? true,
    canViewReviews: props.canViewReviews ?? true,
    canViewComments: props.canViewComments ?? true,
    canVote: props.canVote ?? true,
    canComment: props.canComment ?? true,
    canReview: props.canReview ?? true,
    canPropose: props.canPropose ?? true,
  };
}

function countTitlesByRecommender(list: TitleWithScore[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of list) {
    if (item.addedBy) {
      counts[item.addedBy] = (counts[item.addedBy] ?? 0) + 1;
    }
  }
  return counts;
}

export function GroupContentView(props: GroupContentViewProps) {
  const {
    group,
    members,
    proposed,
    consumed,
    currentUserRole,
    isAdmin,
    currentUserName,
    currentUserEmail,
    currentUserAvatarUrl,
    commentCounts,
    onVote,
    onStartConsuming,
    onMarkConsumed,
    onUnmarkConsumed,
    onSubmitReview,
    onAddComment,
    onDeleteComment,
    onFetchComments,
  } = props;
  const {
    inProgress,
    schedules,
    currentUserId,
    isGuest,
  } = resolveGroupContentCollections(props);
  const {
    canViewBacklog,
    canViewFinished,
    canViewReviews,
    canViewComments,
    canVote,
    canComment,
    canReview,
    canPropose,
  } = resolveGroupContentPermissions(props);

  const defaultTab: GroupTab = !canViewBacklog && canViewFinished ? "consumed" : "proposed";
  const [activeTab, setActiveTab] = useState<GroupTab>(defaultTab);
  const [selectedMediaType, setSelectedMediaType] = useState<string>("all");
  const [selectedRecommender, setSelectedRecommender] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const t = useTranslations();

  const moodFeatureEnabled = useFeatureFlag("mood_pace_folksonomy");
  const wheelFeatureEnabled = useFeatureFlag("blind_pick_wheel");

  const currentList = useMemo(() => {
    const map: Record<GroupTab, TitleWithScore[]> = {
      proposed,
      in_progress: inProgress,
      consumed,
      schedules: [],
    };
    return map[activeTab];
  }, [activeTab, proposed, inProgress, consumed]);

  const recommenderCounts = useMemo(
    () => countTitlesByRecommender(currentList),
    [currentList],
  );

  const recommendersList = useMemo(
    () => buildRecommendersList(members, recommenderCounts, currentUserId, t.common.unnamedUser),
    [members, recommenderCounts, currentUserId, t.common.unnamedUser],
  );

  const filterTitle = useCallback(
    (item: TitleWithScore) =>
      matchesTitleFilter(
        item,
        selectedMediaType,
        selectedRecommender,
        currentUserId,
        moodFeatureEnabled,
        selectedMood,
      ),
    [selectedMediaType, selectedRecommender, currentUserId, moodFeatureEnabled, selectedMood],
  );

  const filteredProposed = useMemo(() => proposed.filter(filterTitle), [proposed, filterTitle]);
  const filteredInProgress = useMemo(() => inProgress.filter(filterTitle), [inProgress, filterTitle]);
  const filteredConsumed = useMemo(() => consumed.filter(filterTitle), [consumed, filterTitle]);

  const isFiltered =
    selectedMediaType !== "all" ||
    selectedRecommender !== "all" ||
    (moodFeatureEnabled && selectedMood !== "all");

  const clearFilters = useCallback(() => {
    setSelectedMediaType("all");
    setSelectedRecommender("all");
    setSelectedMood("all");
  }, []);

  const commentBundle: CommentActionBundle = {
    commentCounts,
    currentUserId,
    currentUserRole,
    isAdmin,
    currentUserName,
    currentUserEmail,
    currentUserAvatarUrl,
    canViewComments,
    canComment,
    onAddComment,
    onDeleteComment,
    onFetchComments,
  };

  const filteredEmptyTitle = resolveFilteredEmptyTitle(
    selectedRecommender,
    selectedMediaType,
    recommendersList,
    t,
  );

  return (
    <div className="flex flex-col gap-6">
      <GroupFilterToolbar
        group={group}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        canViewBacklog={canViewBacklog}
        canViewFinished={canViewFinished}
        proposed={proposed}
        inProgress={inProgress}
        consumed={consumed}
        schedules={schedules}
        selectedMediaType={selectedMediaType}
        setSelectedMediaType={setSelectedMediaType}
        selectedRecommender={selectedRecommender}
        setSelectedRecommender={setSelectedRecommender}
        selectedMood={selectedMood}
        setSelectedMood={setSelectedMood}
        recommendersList={recommendersList}
        currentUserId={currentUserId}
        isFiltered={isFiltered}
        moodFeatureEnabled={moodFeatureEnabled}
        wheelFeatureEnabled={wheelFeatureEnabled}
        onClearFilters={clearFilters}
      />

      {activeTab === "schedules" ? (
        <GroupSchedulesCard
          groupId={group.id}
          schedules={schedules}
          titles={[...proposed, ...consumed]}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isAdmin={isAdmin}
          isOwner={currentUserRole === "owner" || isAdmin}
          isMember={!isGuest}
          memberCount={members.length}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <GroupTabPanels
              activeTab={activeTab}
              group={group}
              membersCount={members.length}
              filteredProposed={filteredProposed}
              filteredInProgress={filteredInProgress}
              filteredConsumed={filteredConsumed}
              isFiltered={isFiltered}
              filteredEmptyTitle={filteredEmptyTitle}
              canPropose={canPropose}
              canVote={canVote}
              canViewReviews={canViewReviews}
              canReview={canReview}
              isGuest={isGuest}
              moodFeatureEnabled={moodFeatureEnabled}
              commentBundle={commentBundle}
              setSelectedMood={setSelectedMood}
              onClearFilters={clearFilters}
              onVote={onVote}
              onStartConsuming={onStartConsuming}
              onMarkConsumed={onMarkConsumed}
              onUnmarkConsumed={onUnmarkConsumed}
              onSubmitReview={onSubmitReview}
            />
          </div>

          <GroupMembersSidebar groupId={group.id} members={members} isGuest={isGuest} />
        </div>
      )}
    </div>
  );
}
