"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Globe,
  Layers,
  MessageSquare,
  Share2,
  Sparkles,
  Star,
  Users,
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
import { CommentThread, type DisplayComment } from "@/components/comment-thread";
import { CircleTitleProgress } from "@/components/circle-title-progress";
import { SpoilerText } from "@/components/spoiler-text";
import { getDisplayName, getInitials } from "@/lib/format";
import { formatRelativeTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";
import type { TitleMemberProgressItem } from "@/lib/actions/progress";
import type {
  CommentsResponse,
  GroupsResponse,
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

type TitleWithScore = TitlesResponse<{
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
}> & {
  score: number;
  userVote?: "up" | "down";
};

interface TitleDetailViewProps {
  group: GroupsResponse;
  title: TitleWithScore;
  comments: CommentsResponse<{ user?: UsersResponse }>[];
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
  ) => Promise<ActionResult<CommentsResponse<{ user?: UsersResponse }>> | CommentsResponse<{ user?: UsersResponse }>>;
  onDeleteComment?: (commentId: string) => Promise<ActionResult<void> | void>;
  onFetchComments?: (
    titleId: string,
  ) => Promise<CommentsResponse<{ user?: UsersResponse }>[]>;
}

export function TitleDetailView({
  group,
  title,
  comments,
  memberProgress = [],
  currentUserId = "",
  currentUserRole,
  isAdmin,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  isGuest = false,
  canViewReviews = true,
  canViewComments = true,
  canVote = true,
  canComment = true,
  canReview = true,
  onVote,
  onMarkConsumed,
  onUnmarkConsumed,
  onSubmitReview,
  onAddComment,
  onDeleteComment,
  onFetchComments,
}: TitleDetailViewProps) {
  const defaultTab = !canViewComments && canViewReviews ? "reviews" : "discussion";
  const [activeTab, setActiveTab] = useState<"discussion" | "reviews">(defaultTab);
  const t = useTranslations();
  const locale = useLocale();

  const reviews = title.expand?.reviews_via_title ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : null;
  const myReview = reviews.find((r) => r.user === currentUserId);
  const otherReviews = reviews.filter((r) => r.user !== currentUserId);

  const recommender = title.expand?.addedBy;
  const recommenderName = getDisplayName(recommender);
  const recommenderInitials = getInitials(recommender?.name, recommender?.email);

  // Extract metadata fields if present
  const meta = (title.metadata ?? {}) as Record<string, unknown>;
  const description =
    (typeof meta.description === "string" && meta.description.trim()) ||
    (typeof meta.overview === "string" && meta.overview.trim()) ||
    null;
  const releaseDate =
    (typeof meta.releaseDate === "string" && meta.releaseDate) ||
    (typeof meta.publishedDate === "string" && meta.publishedDate) ||
    null;
  const pageCount =
    typeof meta.pageCount === "number"
      ? meta.pageCount
      : typeof meta.page_count === "number"
      ? meta.page_count
      : null;
  const totalTracks =
    typeof meta.totalTracks === "number"
      ? meta.totalTracks
      : typeof meta.total_tracks === "number"
      ? meta.total_tracks
      : null;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t.media.mediaLinkCopied);
    } catch {
      toast.error(t.common.error);
    }
  }

  const isFinished = title.status === "consumed";

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Media Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          {/* Large Cover Poster */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <MediaCover
              src={title.coverUrl}
              alt={title.title}
              size="lg"
              className="w-36 h-52 sm:w-44 sm:h-64 rounded-xl shadow-md ring-1 ring-border/50 object-cover"
            />
          </div>

          {/* Details & Actions */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <MediaBadge type={title.mediaType} size="sm" />

              {isFinished ? (
                <Badge
                  variant="default"
                  className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold"
                >
                  <CheckCircle2 className="size-3" />
                  <span>{t.media.finished}</span>
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
                >
                  <Sparkles className="size-3" />
                  <span>{t.media.upNext}</span>
                </Badge>
              )}

              {title.externalSource && title.externalSource !== "custom" && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-muted-foreground uppercase tracking-wider"
                >
                  {title.externalSource}
                </Badge>
              )}
            </div>

            {/* Title & Creator */}
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

            {/* Recommender Attribution Card */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 w-fit text-xs">
              <Avatar size="sm" className="size-6 ring-1 ring-border shrink-0">
                {recommender?.avatarUrl && (
                  <AvatarImage src={recommender.avatarUrl} alt={recommenderName} />
                )}
                <AvatarFallback className="text-[10px]">
                  {recommenderInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                <span>{t.media.recommendedBy}</span>
                <span className="font-semibold text-foreground">
                  {recommenderName}
                </span>
                <span>&middot;</span>
                <span>{formatRelativeTime(title.createdAt, locale)}</span>
              </div>
            </div>

            {/* Rating Summary (if finished or reviewed) */}
            {avgRating !== null && (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  <Star className="size-4 fill-amber-500 text-amber-500" />
                  <span>{avgRating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ({reviews.length} {t.media.reviewsCount})
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Vote Control (when proposed/up next) */}
              {!isFinished && (
                <div className="p-1 rounded-xl bg-muted/60 border border-border/50">
                  <VoteControl
                    score={title.score}
                    userVote={title.userVote}
                    disabled={!canVote}
                    onVote={canVote ? onVote : undefined}
                  />
                </div>
              )}

              {/* Status Toggle Button */}
              {!isGuest && (
                isFinished ? (
                  <MarkConsumedButton
                    direction="unconsume"
                    variant="outline"
                    size="sm"
                    showIcon={true}
                    className="h-9 px-3.5 text-xs font-semibold border-border hover:bg-muted"
                    onMark={onUnmarkConsumed}
                  />
                ) : (
                  <MarkConsumedButton
                    direction="consume"
                    variant="default"
                    size="sm"
                    showIcon={true}
                    className="h-9 px-3.5 text-xs font-semibold shadow-xs"
                    onMark={onMarkConsumed}
                  />
                )
              )}

              {/* Share / Copy Link */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-medium"
              >
                <Share2 className="size-3.5" />
                <span>{t.media.copyMediaLink}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Media Details & Synopsis */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span>{t.media.synopsis}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          {description ? (
            <p className="whitespace-pre-wrap">{description}</p>
          ) : (
            <p className="italic text-muted-foreground/70">{t.media.noSynopsis}</p>
          )}

          {/* Key Facts / Metadata Grid */}
          {(releaseDate || pageCount || totalTracks) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t text-xs">
              {releaseDate && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
                  <Calendar className="size-3.5 text-primary/80 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-medium">
                      {t.media.releaseDate}
                    </span>
                    <span className="font-semibold text-foreground">
                      {releaseDate.slice(0, 10)}
                    </span>
                  </div>
                </div>
              )}

              {pageCount && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
                  <Layers className="size-3.5 text-primary/80 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-medium">
                      {t.media.pageCount}
                    </span>
                    <span className="font-semibold text-foreground">
                      {pageCount}
                    </span>
                  </div>
                </div>
              )}

              {totalTracks && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
                  <Layers className="size-3.5 text-primary/80 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-medium">
                      {t.media.tracks}
                    </span>
                    <span className="font-semibold text-foreground">
                      {totalTracks}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Circle Members Progress on this Title */}
      <CircleTitleProgress
        title={title}
        memberProgress={memberProgress}
        currentUserId={currentUserId}
        isMember={!isGuest}
      />

      {/* Tabs & Discussion / Reviews Sections */}
      {(canViewComments || canViewReviews) && (
        <div className="space-y-4">
          {/* Section Tabs Switcher */}
          {canViewComments && canViewReviews && (
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
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "discussion"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="size-3.5 text-primary" />
                <span>{t.comments.title}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground">
                  {comments.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "reviews"}
                onClick={() => setActiveTab("reviews")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "reviews"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Star className="size-3.5 text-amber-500" />
                <span>{t.reviews.groupReviews}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground">
                  {reviews.length}
                </span>
              </button>
            </div>
          )}

          {/* Discussion Tab (Comments + Nested Replies) */}
          {activeTab === "discussion" && canViewComments && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold tracking-tight">
                  {t.comments.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <CommentThread
                  titleId={title.id}
                  groupId={group.id}
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

          {/* Reviews Tab */}
          {activeTab === "reviews" && canViewReviews && (
            <div className="space-y-6">
              {/* My Review Form Card */}
              {canReview && (
                <Card className="border-border/70 shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {myReview ? t.reviews.yourRatingAndReview : t.reviews.rateThisTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReviewForm
                      defaultRating={myReview?.rating ?? 5}
                      defaultText={myReview?.reviewText ?? ""}
                      hasExisting={Boolean(myReview)}
                      onSubmit={onSubmitReview}
                    />
                  </CardContent>
                </Card>
              )}

            {/* Other Member Reviews */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                  {t.reviews.groupReviews} ({reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-3">
                {reviews.length > 0 ? (
                  reviews.map((r) => {
                    const reviewAuthor = r.expand?.user;
                    const name = getDisplayName(reviewAuthor);
                    const initials = getInitials(
                      reviewAuthor?.name,
                      reviewAuthor?.email,
                    );
                    const isOwn = r.user === currentUserId;

                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "p-3.5 rounded-xl border text-xs space-y-2 transition-colors",
                          isOwn
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/30 border-border/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar size="sm" className="size-6 ring-1 ring-border shrink-0">
                              {reviewAuthor?.avatarUrl && (
                                <AvatarImage
                                  src={reviewAuthor.avatarUrl}
                                  alt={name}
                                />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground">
                              {name}
                            </span>
                            {isOwn && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">
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
                          <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed pl-8">
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
        )}
      </div>
      )}
    </div>
  );
}
