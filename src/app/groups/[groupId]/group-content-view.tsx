"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, Star, Users, Settings } from "lucide-react";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { VoteControl } from "@/components/vote-control";
import { MarkConsumedButton } from "@/components/mark-consumed-button";
import { ReviewForm } from "@/components/review-form";
import { MediaComments } from "@/components/media-comments";
import { EmptyState } from "@/components/empty-state";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MEDIA_TYPES } from "@/lib/media-types";
import { getDisplayName, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type {
  CommentsResponse,
  GroupMembersResponse,
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
  comments_via_title?: CommentsResponse<{ user?: UsersResponse }>[];
}> & {
  score: number;
  userVote?: "up" | "down";
};

interface GroupContentViewProps {
  group: GroupsResponse;
  members: GroupMembersResponse<{ user?: UsersResponse }>[];
  proposed: TitleWithScore[];
  consumed: TitleWithScore[];
  currentUserId: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  onVote: (titleId: string, value: "up" | "down") => Promise<void>;
  onMarkConsumed: (titleId: string) => Promise<void>;
  onSubmitReview: (titleId: string, formData: FormData) => Promise<void>;
  onAddComment?: (titleId: string, formData: FormData) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export function GroupContentView({
  group,
  members,
  proposed,
  consumed,
  currentUserId,
  currentUserRole,
  isAdmin,
  onVote,
  onMarkConsumed,
  onSubmitReview,
  onAddComment,
  onDeleteComment,
}: GroupContentViewProps) {
  const [activeTab, setActiveTab] = useState<"proposed" | "consumed">("proposed");
  const [selectedMediaType, setSelectedMediaType] = useState<string>("all");
  const t = useTranslations();

  const filteredProposed = proposed.filter((t) =>
    selectedMediaType === "all" ? true : t.mediaType === selectedMediaType
  );

  const filteredConsumed = consumed.filter((t) =>
    selectedMediaType === "all" ? true : t.mediaType === selectedMediaType
  );

  return (
    <div className="flex flex-col gap-6">
      {/* View Switcher & Media Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        {/* Main Tabs (Up Next vs Consumed) */}
        <div
          role="tablist"
          aria-label={t.groups.contentViewAria}
          className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 w-fit"
        >
          <button
            type="button"
            role="tab"
            id="proposed-tab"
            aria-selected={activeTab === "proposed"}
            aria-controls="proposed-panel"
            onClick={() => setActiveTab("proposed")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === "proposed"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>{t.media.upNext}</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px]",
              activeTab === "proposed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {proposed.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="consumed-tab"
            aria-selected={activeTab === "consumed"}
            aria-controls="consumed-panel"
            onClick={() => setActiveTab("consumed")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === "consumed"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>{t.media.finished}</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px]",
              activeTab === "consumed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            )}>
              {consumed.length}
            </span>
          </button>
        </div>

        {/* Media Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            aria-pressed={selectedMediaType === "all"}
            onClick={() => setSelectedMediaType("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
              selectedMediaType === "all"
                ? "bg-foreground text-background border-foreground font-semibold"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
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
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap flex items-center gap-1",
                selectedMediaType === type
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              <MediaBadge type={type} size="sm" showIcon={false} className="border-0 bg-transparent p-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Main Content (Backlog or Consumed) */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === "proposed" && (
            <div id="proposed-panel" role="tabpanel" aria-labelledby="proposed-tab">
              {filteredProposed.length > 0 ? (
                <div className="space-y-3">
                  {filteredProposed.map((title, index) => (
                    <Card
                      key={title.id}
                      className="border-border/70 shadow-xs hover:border-border transition-all duration-200"
                    >
                      <CardContent className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
                        {/* Vote Controls */}
                        <div className="shrink-0 flex flex-col items-center">
                          <VoteControl
                            score={title.score}
                            userVote={title.userVote}
                            onVote={(val) => onVote(title.id, val)}
                          />
                        </div>

                        {/* Cover Image */}
                        <MediaCover
                          src={title.coverUrl}
                          alt={title.title}
                          size="md"
                          className="shrink-0 rounded-lg"
                        />

                        {/* Title Details */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <MediaBadge type={title.mediaType} size="sm" />
                            {index === 0 && title.score > 0 && (
                              <Badge variant="default" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                {t.media.topPick}
                              </Badge>
                            )}
                          </div>

                          <div>
                            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2">
                              {title.title}
                            </h3>
                            {title.creator && (
                              <p className="text-xs text-muted-foreground font-medium line-clamp-1 mt-0.5">
                                {title.creator}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-muted-foreground">
                              {t.media.addedBy}:{" "}
                              <span className="font-medium text-foreground">
                                {getDisplayName(title.expand?.addedBy)}
                              </span>
                            </p>
                            <div className="flex items-center gap-1.5">
                              <MediaComments
                                titleId={title.id}
                                groupId={group.id}
                                titleName={title.title}
                                comments={title.expand?.comments_via_title ?? []}
                                currentUserId={currentUserId}
                                currentUserRole={currentUserRole}
                                isAdmin={isAdmin}
                                onAddComment={onAddComment}
                                onDeleteComment={onDeleteComment}
                              />
                              <MarkConsumedButton
                                onMark={() => onMarkConsumed(title.id)}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title={
                    selectedMediaType === "all"
                      ? t.groups.emptyBacklogTitle
                      : t.groups.emptyBacklogFilteredTitle.replace(
                          "{type}",
                          t.media[selectedMediaType as keyof typeof t.media] ?? selectedMediaType
                        )
                  }
                  description={t.groups.emptyBacklogDesc}
                  action={
                    <div className="mt-2">
                      <AddTitleDialog groupId={group.id} groupName={group.name} />
                    </div>
                  }
                />
              )}
            </div>
          )}

          {activeTab === "consumed" && (
            <div id="consumed-panel" role="tabpanel" aria-labelledby="consumed-tab">
              {filteredConsumed.length > 0 ? (
                <div className="space-y-4">
                  {filteredConsumed.map((title) => {
                    const reviews = title.expand?.reviews_via_title ?? [];
                    const avg = reviews.length
                      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
                      : null;
                    const myReview = reviews.find((r) => r.user === currentUserId);
                    const otherReviews = reviews.filter((r) => r.user !== currentUserId);

                    return (
                      <Card
                        key={title.id}
                        className="border-border/70 shadow-xs hover:border-border transition-all duration-200 overflow-hidden"
                      >
                        <CardContent className="p-4 sm:p-5 space-y-4">
                          {/* Title Header */}
                          <div className="flex items-start justify-between gap-3 sm:gap-4">
                            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                              <MediaCover
                                src={title.coverUrl}
                                alt={title.title}
                                size="md"
                                className="shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <MediaBadge type={title.mediaType} size="sm" />
                                  {avg !== null && (
                                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      <Star className="size-3 fill-amber-500 text-amber-500" />
                                      <span>{avg.toFixed(1)}</span>
                                      <span className="text-muted-foreground text-[10px] font-normal">
                                        ({reviews.length} {t.media.reviewsCount})
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <h3 className="text-base font-semibold text-foreground tracking-tight leading-snug">
                                  {title.title}
                                </h3>
                                {title.creator && (
                                  <p className="text-xs text-muted-foreground">
                                    {title.creator}
                                  </p>
                                )}
                              </div>
                            </div>
                            <MediaComments
                              titleId={title.id}
                              groupId={group.id}
                              titleName={title.title}
                              comments={title.expand?.comments_via_title ?? []}
                              currentUserId={currentUserId}
                              currentUserRole={currentUserRole}
                              isAdmin={isAdmin}
                              onAddComment={onAddComment}
                              onDeleteComment={onDeleteComment}
                            />
                          </div>

                          {/* My Review Section */}
                          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                            <p className="text-xs font-semibold text-foreground mb-2">
                              {myReview ? t.reviews.yourRatingAndReview : t.reviews.rateThisTitle}
                            </p>
                            <ReviewForm
                              defaultRating={myReview?.rating ?? 5}
                              defaultText={myReview?.reviewText ?? ""}
                              hasExisting={Boolean(myReview)}
                              onSubmit={(formData) => onSubmitReview(title.id, formData)}
                            />
                          </div>

                          {/* Other Reviews */}
                          {otherReviews.length > 0 && (
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
                                        {getDisplayName(r.expand?.user)}
                                      </span>
                                      <div className="flex items-center gap-0.5 text-amber-400">
                                        {Array.from({ length: r.rating }).map((_, i) => (
                                          <Star key={i} className="size-3 fill-amber-400" />
                                        ))}
                                      </div>
                                    </div>
                                    {r.reviewText && (
                                      <p className="text-muted-foreground leading-relaxed">
                                        &ldquo;{r.reviewText}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title={t.groups.emptyFinishedTitle}
                  description={t.groups.emptyFinishedDesc}
                />
              )}
            </div>
          )}
        </div>

        {/* Right 1 Col: Group Info & Members Sidebar */}
        <div className="space-y-4">
          {/* Members Roster Card */}
          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.groups.members} ({members.length})
                  </h3>
                </div>
                <Link
                  href={`/groups/${group.id}/settings`}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                >
                  <Settings className="size-3.5" />
                  <span>{t.common.manage}</span>
                </Link>
              </div>

              <div className="space-y-2 pt-1">
                {members.map((m) => {
                  const userName = getDisplayName(m.expand?.user);
                  const userEmail = m.expand?.user?.email;
                  const initials = getInitials(m.expand?.user?.name, m.expand?.user?.email);
                  const isOwner = m.role === "owner";

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar size="sm" className="ring-1 ring-border">
                          {m.expand?.user?.avatarUrl && (
                            <AvatarImage src={m.expand?.user?.avatarUrl} alt={userName} />
                          )}
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
      </div>
    </div>
  );
}
