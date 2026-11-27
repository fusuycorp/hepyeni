"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Layers,
  MessageSquare,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { VoteControl } from "@/components/vote-control";
import { MarkConsumedButton } from "@/components/mark-consumed-button";
import { ReviewForm } from "@/components/review-form";
import { CommentThread } from "@/components/comment-thread";
import { CircleTitleProgress } from "@/components/circle-title-progress";
import { SpoilerText } from "@/components/spoiler-text";
import { getDisplayName, getInitials } from "@/lib/format";
import { formatRelativeTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";
import type { TitleMemberProgressItem } from "@/lib/actions/progress";
import type { GroupTitleExpand } from "@/lib/group-titles";
import type { PublicComment } from "@/lib/comments";
import type {
  GroupsResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

type TitleWithScore = TitlesResponse<GroupTitleExpand> & {
  score: number;
  userVote?: "up" | "down";
};

interface TitleDetailViewProps {
  group: GroupsResponse;
  title: TitleWithScore;
  comments: PublicComment[];
  memberProgress?: TitleMemberProgressItem[];
  currentUserId?: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  isGuest?: boolean;
  canViewReviews?: boolean;
  canViewComments?: boolean;
  canVote?: boolean;
  canComment?: boolean;
  canReview?: boolean;
  onVote: (value: "up" | "down") => Promise<ActionResult<void> | void>;
  onMarkConsumed: () => Promise<ActionResult<void> | void>;
  onUnmarkConsumed: () => Promise<ActionResult<void> | void>;
  onSubmitReview: (formData: FormData) => Promise<ActionResult<void> | void>;
  onAddComment?: (
    titleId: string,
    formData: FormData,
  ) => Promise<ActionResult<PublicComment> | PublicComment>;
  onDeleteComment?: (commentId: string) => Promise<ActionResult<void> | void>;
  onFetchComments?: (titleId: string) => Promise<PublicComment[]>;
}

function pickFirstNonEmptyString(
  meta: Record<string, unknown>,
  keyA: string,
  keyB: string,
  trim = false,
): string | null {
  for (const key of [keyA, keyB]) {
    const val = meta[key];
    if (typeof val === "string") {
      const candidate = trim ? val.trim() : val;
      if (candidate) return candidate;
    }
  }
  return null;
}

function pickFirstNumber(
  meta: Record<string, unknown>,
  keyA: string,
  keyB: string,
): number | null {
  if (typeof meta[keyA] === "number") return meta[keyA] as number;
  if (typeof meta[keyB] === "number") return meta[keyB] as number;
  return null;
}

function extractTitleMetadata(title: TitleWithScore) {
  const meta = (title.metadata ?? {}) as Record<string, unknown>;
  return {
    description: pickFirstNonEmptyString(meta, "description", "overview", true),
    releaseDate: pickFirstNonEmptyString(meta, "releaseDate", "publishedDate"),
    pageCount: pickFirstNumber(meta, "pageCount", "page_count"),
    totalTracks: pickFirstNumber(meta, "totalTracks", "total_tracks"),
  };
}

function TitleStatusAndSourceBadges({
  isFinished,
  externalSource,
}: {
  isFinished: boolean;
  externalSource?: string;
}) {
  const t = useTranslations();
  const hasExternalBadge = Boolean(externalSource && externalSource !== "custom");

  return (
    <>
      {isFinished ? (
        <Badge
          variant="default"
          className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold rounded-xs"
        >
          <CheckCircle2 className="size-3" />
          <span>{t.media.finished}</span>
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="gap-1 bg-primary/10 text-primary border-primary/20 text-xs font-semibold rounded-xs"
        >
          <Sparkles className="size-3" />
          <span>{t.media.upNext}</span>
        </Badge>
      )}

      {hasExternalBadge && (
        <Badge
          variant="outline"
          className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono rounded-xs"
        >
          {externalSource}
        </Badge>
      )}
    </>
  );
}

function TitleHeroActionBar({
  isGuest,
  isFinished,
  onMarkConsumed,
  onUnmarkConsumed,
  onCopyLink,
}: {
  isGuest: boolean;
  isFinished: boolean;
  onMarkConsumed: () => Promise<ActionResult<void> | void>;
  onUnmarkConsumed: () => Promise<ActionResult<void> | void>;
  onCopyLink: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {!isGuest && (
        <MarkConsumedButton
          direction={isFinished ? "unconsume" : "consume"}
          variant="outline"
          size="sm"
          showIcon={true}
          className={cn(
            "h-8 px-3 text-xs font-semibold rounded-sm",
            isFinished && "border-border hover:bg-muted",
          )}
          onMark={isFinished ? onUnmarkConsumed : onMarkConsumed}
        />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopyLink}
        className="h-8 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-medium rounded-sm"
      >
        <Share2 className="size-3.5" />
        <span>{t.media.copyMediaLink}</span>
      </Button>
    </div>
  );
}

function TitleHeroSection({
  title,
  isFinished,
  isGuest,
  canVote,
  avgRating,
  reviewsCount,
  onVote,
  onMarkConsumed,
  onUnmarkConsumed,
  onCopyLink,
}: {
  title: TitleWithScore;
  isFinished: boolean;
  isGuest: boolean;
  canVote: boolean;
  avgRating: number | null;
  reviewsCount: number;
  onVote: (value: "up" | "down") => Promise<ActionResult<void> | void>;
  onMarkConsumed: () => Promise<ActionResult<void> | void>;
  onUnmarkConsumed: () => Promise<ActionResult<void> | void>;
  onCopyLink: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const recommender = title.expand?.addedBy;
  const recommenderName = getDisplayName(recommender, t.common.unnamedUser);
  const recommenderInitials = getInitials(recommender?.name);

  return (
    <div className="relative overflow-hidden rounded-sm border border-border/60 bg-card p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <div className="shrink-0 flex items-start gap-3 sm:gap-4 mx-auto sm:mx-0">
          {!isFinished && (
            <div className="pt-1 sm:pt-2">
              <VoteControl
                score={title.score}
                userVote={title.userVote}
                orientation="vertical"
                disabled={!canVote}
                onVote={canVote ? onVote : undefined}
              />
            </div>
          )}

          <MediaCover
            src={title.coverUrl}
            alt={title.title}
            size="lg"
            className="w-36 h-52 sm:w-44 sm:h-64 rounded-sm border border-border/60 object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-4 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <MediaBadge type={title.mediaType} size="sm" />
            <TitleStatusAndSourceBadges
              isFinished={isFinished}
              externalSource={title.externalSource}
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
              {title.title}
            </h1>
            {title.creator && (
              <p className="text-sm sm:text-base font-medium text-muted-foreground">
                {title.creator}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-xs bg-muted/40 border border-border/60 w-fit text-xs">
            <Avatar size="sm" className="size-6 shrink-0">
              {recommender?.avatarUrl && (
                <AvatarImage src={recommender.avatarUrl} alt={recommenderName} />
              )}
              <AvatarFallback className="text-[10px]">
                {recommenderInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span>{t.media.recommendedBy}</span>
              <span className="font-semibold text-foreground">{recommenderName}</span>
              <span>&middot;</span>
              <span>{formatRelativeTime(title.createdAt, locale)}</span>
            </div>
          </div>

          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-xs border border-amber-500/20 font-mono">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                <span>{avgRating.toFixed(1)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                ({reviewsCount} {t.media.reviewsCount})
              </span>
            </div>
          )}

          <TitleHeroActionBar
            isGuest={isGuest}
            isFinished={isFinished}
            onMarkConsumed={onMarkConsumed}
            onUnmarkConsumed={onUnmarkConsumed}
            onCopyLink={onCopyLink}
          />
        </div>
      </div>
    </div>
  );
}

function TitleSynopsisCard({
  description,
  releaseDate,
  pageCount,
  totalTracks,
}: ReturnType<typeof extractTitleMetadata>) {
  const t = useTranslations();
  const hasFacts = Boolean(releaseDate || pageCount || totalTracks);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span>{t.media.synopsis}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm text-muted-foreground leading-relaxed">
        {description ? (
          <p className="font-serif text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        ) : (
          <p className="italic text-muted-foreground/70">{t.media.noSynopsis}</p>
        )}

        {hasFacts && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs">
            {releaseDate && (
              <div className="flex items-center gap-2 p-2.5 rounded-xs bg-muted/30 border border-border/60">
                <Calendar className="size-3.5 text-primary/80 shrink-0" />
                <div>
                  <span className="block text-[10px] text-muted-foreground font-medium">
                    {t.media.releaseDate}
                  </span>
                  <span className="font-semibold font-mono text-foreground">
                    {releaseDate.slice(0, 10)}
                  </span>
                </div>
              </div>
            )}

            {pageCount && (
              <div className="flex items-center gap-2 p-2.5 rounded-xs bg-muted/30 border border-border/60">
                <Layers className="size-3.5 text-primary/80 shrink-0" />
                <div>
                  <span className="block text-[10px] text-muted-foreground font-medium">
                    {t.media.pageCount}
                  </span>
                  <span className="font-semibold font-mono text-foreground">
                    {pageCount}
                  </span>
                </div>
              </div>
            )}

            {totalTracks && (
              <div className="flex items-center gap-2 p-2.5 rounded-xs bg-muted/30 border border-border/60">
                <Layers className="size-3.5 text-primary/80 shrink-0" />
                <div>
                  <span className="block text-[10px] text-muted-foreground font-medium">
                    {t.media.tracks}
                  </span>
                  <span className="font-semibold text-foreground">{totalTracks}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TitleReviewsPanel({
  reviews,
  currentUserId,
  canReview,
  onSubmitReview,
}: {
  reviews: NonNullable<GroupTitleExpand["reviews_via_title"]>;
  currentUserId: string;
  canReview: boolean;
  onSubmitReview: (formData: FormData) => Promise<ActionResult<void> | void>;
}) {
  const t = useTranslations();
  const myReview = reviews.find((r) => r.user === currentUserId);

  return (
    <div className="space-y-6">
      {canReview && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-semibold text-foreground">
              {myReview ? t.reviews.yourRatingAndReview : t.reviews.rateThisTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ReviewForm
              defaultRating={myReview?.rating ?? 5}
              defaultText={myReview?.reviewText ?? ""}
              hasExisting={Boolean(myReview)}
              onSubmit={onSubmitReview}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
            {t.reviews.groupReviews} ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          {reviews.length > 0 ? (
            reviews.map((r) => {
              const reviewAuthor = r.expand?.user;
              const name = getDisplayName(reviewAuthor, t.common.unnamedUser);
              const initials = getInitials(reviewAuthor?.name);
              const isOwn = r.user === currentUserId;

              return (
                <div
                  key={r.id}
                  className={cn(
                    "p-3.5 rounded-sm border text-xs space-y-2 transition-colors",
                    isOwn ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="size-6 shrink-0">
                        {reviewAuthor?.avatarUrl && (
                          <AvatarImage src={reviewAuthor.avatarUrl} alt={name} />
                        )}
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-foreground">{name}</span>
                      {isOwn && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 rounded-xs font-mono">
                          {t.groups.myRecommendations}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="size-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  {r.reviewText && (
                    <div className="font-serif text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed pl-8">
                      &ldquo;<SpoilerText text={r.reviewText} />&rdquo;
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <Star className="size-8 text-muted-foreground/40" />
              <p className="text-xs">{t.reviews.noReviewsYet}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiscussionAndReviewsTabs({
  activeTab,
  setActiveTab,
  commentsCount,
  reviewsCount,
}: {
  activeTab: "discussion" | "reviews";
  setActiveTab: (tab: "discussion" | "reviews") => void;
  commentsCount: number;
  reviewsCount: number;
}) {
  const t = useTranslations();
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 w-fit"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "discussion"}
        onClick={() => setActiveTab("discussion")}
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-xs text-xs font-medium transition-all",
          activeTab === "discussion"
            ? "bg-background text-foreground shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MessageSquare className="size-3.5 text-primary" />
        <span>{t.comments.title}</span>
        <span className="px-1.5 py-0.2 rounded-xs font-mono text-[10px] bg-muted text-muted-foreground">
          {commentsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "reviews"}
        onClick={() => setActiveTab("reviews")}
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-xs text-xs font-medium transition-all",
          activeTab === "reviews"
            ? "bg-background text-foreground shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Star className="size-3.5 text-amber-500" />
        <span>{t.reviews.groupReviews}</span>
        <span className="px-1.5 py-0.2 rounded-xs font-mono text-[10px] bg-muted text-muted-foreground">
          {reviewsCount}
        </span>
      </button>
    </div>
  );
}

function resolveDefaultDiscussionTab(
  canViewComments: boolean,
  canViewReviews: boolean,
): "discussion" | "reviews" {
  return !canViewComments && canViewReviews ? "reviews" : "discussion";
}

function TitleDiscussionAndReviewsSection({
  titleId,
  groupId,
  comments,
  reviews,
  currentUserId,
  currentUserRole,
  isAdmin,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  canViewComments,
  canViewReviews,
  canComment,
  canReview,
  onSubmitReview,
  onAddComment,
  onDeleteComment,
  onFetchComments,
}: {
  titleId: string;
  groupId: string;
  comments: PublicComment[];
  reviews: NonNullable<GroupTitleExpand["reviews_via_title"]>;
  currentUserId: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  canViewComments: boolean;
  canViewReviews: boolean;
  canComment: boolean;
  canReview: boolean;
  onSubmitReview: (formData: FormData) => Promise<ActionResult<void> | void>;
  onAddComment?: TitleDetailViewProps["onAddComment"];
  onDeleteComment?: TitleDetailViewProps["onDeleteComment"];
  onFetchComments?: TitleDetailViewProps["onFetchComments"];
}) {
  const [activeTab, setActiveTab] = useState<"discussion" | "reviews">(
    resolveDefaultDiscussionTab(canViewComments, canViewReviews),
  );
  const t = useTranslations();

  if (!canViewComments && !canViewReviews) return null;

  return (
    <div className="space-y-4">
      {canViewComments && canViewReviews && (
        <DiscussionAndReviewsTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          commentsCount={comments.length}
          reviewsCount={reviews.length}
        />
      )}

      {activeTab === "discussion" && canViewComments && (
        <Card className="border-border/60">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold tracking-tight">
              {t.comments.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <CommentThread
              titleId={titleId}
              groupId={groupId}
              initialComments={comments}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isAdmin={isAdmin}
              currentUserName={currentUserName}
              currentUserEmail={currentUserEmail}
              currentUserAvatarUrl={currentUserAvatarUrl}
              canComment={canComment}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onFetchComments={onFetchComments}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "reviews" && canViewReviews && (
        <TitleReviewsPanel
          reviews={reviews}
          currentUserId={currentUserId}
          canReview={canReview}
          onSubmitReview={onSubmitReview}
        />
      )}
    </div>
  );
}

function resolveTitleDetailDefaults(props: TitleDetailViewProps) {
  return {
    memberProgress: props.memberProgress ?? [],
    currentUserId: props.currentUserId ?? "",
    isGuest: props.isGuest ?? false,
    canViewReviews: props.canViewReviews ?? true,
    canViewComments: props.canViewComments ?? true,
    canVote: props.canVote ?? true,
    canComment: props.canComment ?? true,
    canReview: props.canReview ?? true,
  };
}

export function TitleDetailView(props: TitleDetailViewProps) {
  const {
    group,
    title,
    comments,
    currentUserRole,
    isAdmin,
    currentUserName,
    currentUserEmail,
    currentUserAvatarUrl,
    onVote,
    onMarkConsumed,
    onUnmarkConsumed,
    onSubmitReview,
    onAddComment,
    onDeleteComment,
    onFetchComments,
  } = props;
  const {
    memberProgress,
    currentUserId,
    isGuest,
    canViewReviews,
    canViewComments,
    canVote,
    canComment,
    canReview,
  } = resolveTitleDetailDefaults(props);
  const t = useTranslations();

  const reviews = title.expand?.reviews_via_title ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : null;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t.media.mediaLinkCopied);
    } catch {
      toast.error(t.common.error);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <TitleHeroSection
        title={title}
        isFinished={title.status === "consumed"}
        isGuest={isGuest}
        canVote={canVote}
        avgRating={avgRating}
        reviewsCount={reviews.length}
        onVote={onVote}
        onMarkConsumed={onMarkConsumed}
        onUnmarkConsumed={onUnmarkConsumed}
        onCopyLink={handleCopyLink}
      />

      <TitleSynopsisCard {...extractTitleMetadata(title)} />

      <CircleTitleProgress
        title={title}
        memberProgress={memberProgress}
        currentUserId={currentUserId}
        isMember={!isGuest}
      />

      <TitleDiscussionAndReviewsSection
        titleId={title.id}
        groupId={group.id}
        comments={comments}
        reviews={reviews}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isAdmin={isAdmin}
        currentUserName={currentUserName}
        currentUserEmail={currentUserEmail}
        currentUserAvatarUrl={currentUserAvatarUrl}
        canViewComments={canViewComments}
        canViewReviews={canViewReviews}
        canComment={canComment}
        canReview={canReview}
        onSubmitReview={onSubmitReview}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onFetchComments={onFetchComments}
      />
    </div>
  );
}
