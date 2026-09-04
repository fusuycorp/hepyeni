import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { MediaBadge } from "@/components/media-badge";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { SpoilerText } from "@/components/spoiler-text";
import {
  adminDeleteReview,
  adminDeleteTitle,
  adminRemoveGroupMember,
} from "@/lib/actions/admin";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import { attachTitleTallies } from "@/lib/admin-groups";
import type {
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

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const pb = await getSuperuserClient();
  const t = await getServerTranslations();

  let group: GroupsResponse;
  try {
    group = await pb.collection("groups").getOne<GroupsResponse>(groupId);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  const [members, titles, votes, reviews] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      }),
    // M-1 (perf): wire-level projection on the titles scan — no more full
    // record bodies for every title, and the votes/reviews are no longer
    // expanded through titles (each was a copy of the full row per parent).
    pb
      .collection("titles")
      .getFullList<TitlesResponse<{ addedBy?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        sort: "-createdAt",
        fields:
          "id,title,creator,mediaType,coverUrl,status,createdAt,addedBy,metadata," +
          "expand.addedBy.name,expand.addedBy.email",
        expand: "addedBy",
      }),
    // Lean per-collection queries: PB projects relation fields via
    // `title.group` (dot-notation) and the `expand.rel.field` fields syntax
    // (PocketBase 0.39). Reviews fetch reviewText on demand — the detail page
    // renders review bodies here — without relaying it through titles.
    pb.collection("votes").getFullList<VotesResponse>({
      filter: pb.filter("title.group = {:groupId}", { groupId }),
      fields: "id,title,user,value",
    }),
    pb
      .collection("reviews")
      .getFullList<ReviewsResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("title.group = {:groupId}", { groupId }),
        fields:
          "id,title,user,rating,reviewText,createdAt," +
          "expand.user.name,expand.user.email",
        expand: "user",
      }),
  ]);

  const groupTitles = attachTitleTallies(
    titles,
    votes,
    reviews,
  ) as TitlesResponse<TitleExpand>[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-2 border-b">
        <Link
          href="/admin/groups"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="size-3.5" />
          <span>{t.groups.allCircles}</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {group.name}
            </h1>
            <CopyInviteButton code={group.inviteCode} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t.admin.groupIdLabel}: <span className="font-mono">{group.id}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Titles & Moderation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t.admin.titlesSectionTitle.replace("{n}", String(groupTitles.length))}
            </h2>
          </div>

          <div className="space-y-3">
            {groupTitles.map((title) => {
              const votes = title.expand?.votes_via_title ?? [];
              const reviews = title.expand?.reviews_via_title ?? [];
              const score = votes.reduce(
                (acc, v) => acc + (v.value === "up" ? 1 : -1),
                0,
              );

              return (
                <Card key={title.id} className="border-border/70 shadow-2xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MediaBadge type={title.mediaType} size="sm" />
                          <Badge variant={title.status === "consumed" ? "secondary" : "default"} className="text-[10px] py-0">
                            {title.status === "consumed" ? t.media.consumed : t.media.pending}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {t.admin.scoreLabel}: {score}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {title.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t.media.addedBy}: {title.expand?.addedBy?.name ?? title.expand?.addedBy?.email ?? t.common.unknown}
                        </p>
                      </div>

                      <ConfirmActionButton
                        triggerLabel={
                          <>
                            <Trash2 className="size-3" />
                            <span>{t.common.delete}</span>
                          </>
                        }
                        triggerVariant="ghost"
                        variant="destructive"
                        size="xs"
                        className="text-destructive hover:bg-destructive/10 text-xs h-7 gap-1"
                        title={t.admin.deleteTitleConfirmTitle.replace("{name}", title.title)}
                        description={t.admin.deleteTitleConfirmDesc}
                        confirmLabel={t.common.deletePermanently}
                        pendingLabel={t.common.deleting}
                        onConfirm={adminDeleteTitle.bind(null, title.id, groupId)}
                      />
                    </div>

                    {reviews.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                          {t.admin.reviewsCountLabel.replace("{n}", String(reviews.length))}
                        </p>
                        <div className="space-y-1">
                          {reviews.map((review) => (
                            <div
                              key={review.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-muted/40"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {review.expand?.user?.name ?? review.expand?.user?.email}
                                </span>
                                <span className="text-amber-500 font-semibold">★ {review.rating}</span>
                                {review.reviewText && (
                                  <span className="text-muted-foreground italic max-w-xs">
                                    &ldquo;<SpoilerText text={review.reviewText} />&rdquo;
                                  </span>
                                )}
                              </div>

                              <ConfirmActionButton
                                triggerLabel={t.common.delete}
                                triggerVariant="ghost"
                                variant="destructive"
                                size="xs"
                                className="text-destructive hover:bg-destructive/10 h-6 px-1.5 text-[11px]"
                                title={t.admin.deleteReviewConfirmTitle}
                                description={t.admin.deleteReviewConfirmDesc}
                                confirmLabel={t.common.deletePermanently}
                                pendingLabel={t.common.deleting}
                                onConfirm={adminDeleteReview.bind(null, review.id, groupId)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {groupTitles.length === 0 && (
              <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                {t.admin.noTitlesYet}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Members List */}
        <div className="space-y-4">
          <Card className="border-border/70 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {t.admin.groupMembersTitle} ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 text-xs"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {m.expand?.user?.name ?? m.expand?.user?.email}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {m.role === "owner" ? t.groups.ownerBadge : t.groups.memberBadge}
                    </span>
                  </div>

                  <ConfirmActionButton
                    triggerLabel={
                      <>
                        <UserMinus className="size-3 mr-1" />
                        <span>{t.groups.removeButton}</span>
                      </>
                    }
                    triggerVariant="ghost"
                    variant="destructive"
                    size="xs"
                    className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                    title={t.groups.removeMemberConfirmTitle.replace("{name}", m.expand?.user?.name ?? m.expand?.user?.email ?? t.common.unknown)}
                    description={t.groups.removeMemberDesc}
                    confirmLabel={t.groups.removeButton}
                    pendingLabel={t.groups.removing}
                    onConfirm={adminRemoveGroupMember.bind(null, groupId, m.user)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
