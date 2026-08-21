"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, Star, Users, Settings, User, Filter, X, Calendar } from "lucide-react";
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
import { useTranslations, useLocale } from "@/lib/i18n/client";
import { useFeatureFlag } from "@/lib/flags/client";
import { DecisionWheelDialog } from "@/components/decision-wheel-dialog";
import { MOODS, MOOD_DETAILS, type MoodType } from "@/lib/moods";
import { Smile } from "lucide-react";
import type { TitlePayload } from "@/lib/group-titles";
import type { ActionResult } from "@/types/actions";
import type { PublicComment } from "@/lib/comments";
import type { GroupScheduleWithMilestones } from "@/lib/actions/schedules";
import type {
  GroupMembersResponse,
  GroupsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

type TitleWithScore = TitlePayload & {
  moods?: MoodType[] | null;
  pace?: string | null;
};

interface GroupContentViewProps {
  group: GroupsResponse;
  members: GroupMembersResponse<{ user?: UsersResponse }>[];
  proposed: TitleWithScore[];
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

export function GroupContentView({
  group,
  members,
  proposed,
  consumed,
  schedules = [],
  currentUserId = "",
  currentUserRole,
  isAdmin,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  commentCounts,
  isGuest = false,
  canViewBacklog = true,
  canViewFinished = true,
  canViewReviews = true,
  canViewComments = true,
  canVote = true,
  canComment = true,
  canReview = true,
  canPropose = true,
  onVote,
  onMarkConsumed,
  onUnmarkConsumed,
  onSubmitReview,
  onAddComment,
  onDeleteComment,
  onFetchComments,
}: GroupContentViewProps) {
  const defaultTab = !canViewBacklog && canViewFinished ? "consumed" : "proposed";
  const [activeTab, setActiveTab] = useState<"proposed" | "consumed" | "schedules">(defaultTab);
  const [selectedMediaType, setSelectedMediaType] = useState<string>("all");
  const [selectedRecommender, setSelectedRecommender] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const t = useTranslations();

  const moodFeatureEnabled = useFeatureFlag("mood_pace_folksonomy");
  const wheelFeatureEnabled = useFeatureFlag("blind_pick_wheel");

  const currentList = activeTab === "proposed" ? proposed : activeTab === "consumed" ? consumed : [];

  const recommenderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of currentList) {
      if (item.addedBy) {
        counts[item.addedBy] = (counts[item.addedBy] ?? 0) + 1;
      }
    }
    return counts;
  }, [currentList]);

  const recommendersList = useMemo(() => {
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
          name: getDisplayName(user, t.common.unnamedUser),
          avatarUrl: user?.avatarUrl,
          count,
        });
      }
    }
    return Array.from(map.values());
  }, [members, recommenderCounts, currentUserId, t]);

  const filterTitle = (item: TitleWithScore) => {
    const matchesType =
      selectedMediaType === "all" ? true : item.mediaType === selectedMediaType;
    const matchesRecommender =
      selectedRecommender === "all"
        ? true
        : selectedRecommender === "me"
        ? item.addedBy === currentUserId
        : item.addedBy === selectedRecommender;
    const itemMoods =
      (Array.isArray(item.moods)
        ? item.moods
        : (item.metadata?.moods as string[] | undefined)) ?? [];
    const matchesMood =
      !moodFeatureEnabled || selectedMood === "all"
        ? true
        : itemMoods.includes(selectedMood);
    return matchesType && matchesRecommender && matchesMood;
  };

  const filteredProposed = proposed.filter(filterTitle);
  const filteredConsumed = consumed.filter(filterTitle);

  const isFiltered =
    selectedMediaType !== "all" ||
    selectedRecommender !== "all" ||
    (moodFeatureEnabled && selectedMood !== "all");

  const selectedMemberName =
    selectedRecommender === "me"
      ? t.groups.myRecommendations
      : recommendersList.find((r) => r.id === selectedRecommender)?.name ??
        t.groups.allRecommenders;

  return (
    <div className="flex flex-col gap-6">
      {/* View Switcher & Filters */}
      <div className="space-y-3 pb-3 border-b">
        {/* Main Tabs (Up Next vs Consumed) & Media Types */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          {(canViewBacklog || canViewFinished) && (
            <div
              role="tablist"
              aria-label={t.groups.contentViewAria}
              className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 w-fit"
            >
              {canViewBacklog && (
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
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      activeTab === "proposed"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {proposed.length}
                  </span>
                </button>
              )}

              {canViewFinished && (
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
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      activeTab === "consumed"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {consumed.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                role="tab"
                id="schedules-tab"
                aria-selected={activeTab === "schedules"}
                aria-controls="schedules-panel"
                onClick={() => setActiveTab("schedules")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "schedules"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="size-3.5 text-primary" />
                <span>{t.schedules.schedulesTitle}</span>
                {schedules && schedules.length > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      activeTab === "schedules"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {schedules.length}
                  </span>
                )}
              </button>
            </div>
          )}

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
                <MediaBadge
                  type={type}
                  size="sm"
                  showIcon={false}
                  className="border-0 bg-transparent p-0"
                />
              </button>
            ))}

            {wheelFeatureEnabled && canViewBacklog && proposed.length > 0 && activeTab === "proposed" && (
              <div className="ml-auto pl-2">
                <DecisionWheelDialog
                  items={proposed}
                  groupId={group.id}
                  groupName={group.name}
                />
              </div>
            )}
          </div>
        </div>

        {/* Secondary Filter: Recommender / Member Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs pt-1">
          <div className="flex items-center gap-1 text-muted-foreground font-medium shrink-0 pr-1">
            <User className="size-3.5" />
            <span className="hidden sm:inline">{t.groups.recommenderLabel}:</span>
          </div>

          <button
            type="button"
            aria-pressed={selectedRecommender === "all"}
            onClick={() => setSelectedRecommender("all")}
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
              selectedRecommender === "all"
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            {t.groups.allRecommenders}
          </button>

          {recommendersList.map((rec) => {
            const isMe = rec.id === currentUserId;
            const isSelected =
              selectedRecommender === rec.id ||
              (isMe && selectedRecommender === "me");
            return (
              <button
                key={rec.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedRecommender(isSelected ? "all" : rec.id)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{isMe ? t.groups.myRecommendations : rec.name}</span>
                {rec.count > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
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
              onClick={() => {
                setSelectedMediaType("all");
                setSelectedRecommender("all");
                setSelectedMood("all");
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap ml-auto"
            >
              <X className="size-3" />
              <span>{t.groups.clearFilters}</span>
            </button>
          )}
        </div>

        {/* Tertiary Filter: Mood & Tone Pills (if flag enabled) */}
        {moodFeatureEnabled && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs pt-1 border-t border-border/40">
            <div className="flex items-center gap-1 text-muted-foreground font-medium shrink-0 pr-1">
              <Smile className="size-3.5" />
              <span className="hidden sm:inline">{t.moods.filterByMood}:</span>
            </div>

            <button
              type="button"
              aria-pressed={selectedMood === "all"}
              onClick={() => setSelectedMood("all")}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                selectedMood === "all"
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
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
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                      : cn(
                          "bg-background text-muted-foreground border-border hover:text-foreground",
                          detail?.bgColor
                        )
                  )}
                >
                  <span>{detail?.emoji}</span>
                  <span>{t.moods[mood]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>


      {/* Content View: Schedules or Backlog/Finished Grid */}
      {activeTab === "schedules" ? (
        <GroupSchedulesCard
          groupId={group.id}
          schedules={schedules || []}
          titles={[...proposed, ...consumed]}
          isOwner={currentUserRole === "owner" || isAdmin}
          isMember={!isGuest}
          memberCount={members.length}
        />
      ) : (
        /* Content Grid */
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
                            disabled={!canVote}
                            onVote={canVote ? (val) => onVote(title.id, val) : undefined}
                          />
                        </div>

                        {/* Cover Image */}
                        <Link
                          href={`/groups/${group.id}/titles/${title.id}`}
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
                            <Link
                              href={`/groups/${group.id}/titles/${title.id}`}
                              className="group/title inline-block"
                            >
                              <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2 group-hover/title:text-primary transition-colors">
                                {title.title}
                              </h3>
                            </Link>
                            {title.creator && (
                              <p className="text-xs text-muted-foreground font-medium line-clamp-1 mt-0.5">
                                {title.creator}
                              </p>
                            )}

                            {moodFeatureEnabled && (
                              (() => {
                                const rawMoods = (Array.isArray(title.moods)
                                  ? title.moods
                                  : (title.metadata?.moods as MoodType[] | undefined)) ?? [];
                                const itemMoods: MoodType[] = Array.isArray(rawMoods)
                                  ? (rawMoods.filter((x): x is MoodType => typeof x === "string" && x in MOOD_DETAILS))
                                  : [];
                                if (itemMoods.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {itemMoods.map((m: MoodType) => {
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
                              })()
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-muted-foreground">
                              {t.media.addedBy}:{" "}
                              <span className="font-medium text-foreground">
                                {title.expand?.addedBy
                                  ? getDisplayName(title.expand.addedBy, t.common.unnamedUser)
                                  : t.blindPick.anonymousRecommender}
                              </span>
                            </p>
                            <div className="flex items-center gap-1.5">
                              {canViewComments && (
                                <MediaComments
                                  titleId={title.id}
                                  groupId={group.id}
                                  titleName={title.title}
                                  initialCount={commentCounts[title.id] ?? 0}
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
                              )}
                              {!isGuest && (
                                <MarkConsumedButton
                                  onMark={() => onMarkConsumed(title.id)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={isFiltered ? Filter : Sparkles}
                  title={
                    isFiltered
                      ? selectedRecommender !== "all"
                        ? t.groups.noRecommendationsFilter.replace(
                            "{name}",
                            selectedMemberName
                          )
                        : t.groups.emptyBacklogFilteredTitle.replace(
                            "{type}",
                            t.media[selectedMediaType as keyof typeof t.media] ??
                              selectedMediaType
                          )
                      : t.groups.emptyBacklogTitle
                  }
                  description={
                    isFiltered
                      ? t.titles.cantFindMediaDesc
                      : t.groups.emptyBacklogDesc
                  }
                  action={
                    isFiltered ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 font-medium"
                        onClick={() => {
                          setSelectedMediaType("all");
                          setSelectedRecommender("all");
                        }}
                      >
                        <X className="size-3.5" />
                        <span>{t.groups.clearFilters}</span>
                      </Button>
                    ) : canPropose ? (
                      <div className="mt-2">
                        <AddTitleDialog
                          groupId={group.id}
                          groupName={group.name}
                        />
                      </div>
                    ) : undefined
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
                              <Link
                                href={`/groups/${group.id}/titles/${title.id}`}
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
                                <Link
                                  href={`/groups/${group.id}/titles/${title.id}`}
                                  className="group/title inline-block"
                                >
                                  <h3 className="text-base font-semibold text-foreground tracking-tight leading-snug group-hover/title:text-primary transition-colors">
                                    {title.title}
                                  </h3>
                                </Link>
                                {title.creator && (
                                  <p className="text-xs text-muted-foreground">
                                    {title.creator}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {canViewComments && (
                                <MediaComments
                                  titleId={title.id}
                                  groupId={group.id}
                                  titleName={title.title}
                                  initialCount={commentCounts[title.id] ?? 0}
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
                              )}
                              {!isGuest && (
                                <MarkConsumedButton
                                  direction="unconsume"
                                  onMark={() => onUnmarkConsumed(title.id)}
                                />
                              )}
                            </div>
                          </div>

                          {/* My Review Section */}
                          {canReview && (
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
                          )}

                          {/* Other Reviews */}
                          {canViewReviews && otherReviews.length > 0 && (
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
                                        this page — the full body lives on the
                                        title-detail page, linked here. */}
                                    <Link
                                      href={`/groups/${group.id}/titles/${title.id}`}
                                      className="inline-flex items-center text-[11px] text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      {t.media.viewDetails}
                                    </Link>
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
                  icon={isFiltered ? Filter : CheckCircle2}
                  title={
                    isFiltered
                      ? selectedRecommender !== "all"
                        ? t.groups.noRecommendationsFilter.replace(
                            "{name}",
                            selectedMemberName
                          )
                        : t.groups.emptyBacklogFilteredTitle.replace(
                            "{type}",
                            t.media[selectedMediaType as keyof typeof t.media] ??
                              selectedMediaType
                          )
                      : t.groups.emptyFinishedTitle
                  }
                  description={
                    isFiltered
                      ? t.titles.cantFindMediaDesc
                      : t.groups.emptyFinishedDesc
                  }
                  action={
                    isFiltered ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 font-medium"
                        onClick={() => {
                          setSelectedMediaType("all");
                          setSelectedRecommender("all");
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
                {!isGuest && (
                  <Link
                    href={`/groups/${group.id}/settings`}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                  >
                    <Settings className="size-3.5" />
                    <span>{t.common.manage}</span>
                  </Link>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {members.map((m) => {
                  const userName = getDisplayName(m.expand?.user, t.common.unnamedUser);
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
      )}
    </div>
  );
}
