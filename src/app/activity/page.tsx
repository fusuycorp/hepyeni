import Link from "next/link";
import { redirect } from "next/navigation";
import { Rss, Star } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  GroupsResponse,
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

type ActivityItem =
  | {
      kind: "proposed";
      at: string;
      title: TitlesResponse<{ group?: GroupsResponse; addedBy?: UsersResponse }>;
    }
  | {
      kind: "reviewed";
      at: string;
      review: ReviewsResponse<{
        title?: TitlesResponse<{ group?: GroupsResponse }>;
        user?: UsersResponse;
      }>;
    };

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();

  const [memberships, userRecord] = await Promise.all([
    pb.collection("group_members").getFullList<GroupMembersResponse>({
      filter: pb.filter("user = {:userId}", { userId: session.id }),
    }),
    pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null),
  ]);

  const groupIds = memberships.map((m) => m.group);
  let items: ActivityItem[] = [];

  if (groupIds.length > 0) {
    const filterParams = Object.fromEntries(groupIds.map((id, i) => [`g${i}`, id]));
    const titleGroupFilter = pb.filter(
      `(${groupIds.map((_, i) => `group = {:g${i}}`).join(" || ")})`,
      filterParams,
    );
    const reviewGroupFilter = pb.filter(
      `(${groupIds.map((_, i) => `title.group = {:g${i}}`).join(" || ")})`,
      filterParams,
    );

    const [titles, reviews] = await Promise.all([
      pb
        .collection("titles")
        .getList<TitlesResponse<{ group?: GroupsResponse; addedBy?: UsersResponse }>>(
          1,
          30,
          { filter: titleGroupFilter, expand: "group,addedBy", sort: "-createdAt" },
        ),
      pb
        .collection("reviews")
        .getList<
          ReviewsResponse<{
            title?: TitlesResponse<{ group?: GroupsResponse }>;
            user?: UsersResponse;
          }>
        >(1, 30, {
          filter: reviewGroupFilter,
          expand: "title.group,user",
          sort: "-createdAt",
        }),
    ]);

    items = [
      ...titles.items.map((title): ActivityItem => ({
        kind: "proposed",
        at: title.createdAt,
        title,
      })),
      ...reviews.items.map((review): ActivityItem => ({
        kind: "reviewed",
        at: review.createdAt,
        review,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell user={currentUser} maxWidth="wide" title="Recent Activity">
      <div className="flex flex-col gap-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Activity Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time proposals, votes, and member reviews across all your circles.
          </p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.slice(0, 30).map((item) => {
              if (item.kind === "proposed") {
                const { title } = item;
                const group = title.expand?.group;
                const author = title.expand?.addedBy;
                const authorName = author?.name || author?.email || "Member";
                const initials = authorName.slice(0, 2).toUpperCase();

                return (
                  <Link
                    key={`t-${title.id}`}
                    href={group ? `/groups/${group.id}` : "#"}
                    className="group block"
                  >
                    <Card className="border-border/70 hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-xs">
                      <CardContent className="p-4 flex items-start gap-3 sm:gap-4">
                        <Avatar size="sm" className="ring-1 ring-border shrink-0 mt-0.5">
                          {author?.avatarUrl && <AvatarImage src={author.avatarUrl} alt={authorName} />}
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{authorName}</span>
                              <span>proposed a new title</span>
                              {group && (
                                <>
                                  <span>in</span>
                                  <Badge variant="secondary" className="text-[10px] font-medium py-0">
                                    {group.name}
                                  </Badge>
                                </>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {formatRelativeTime(title.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40 group-hover:bg-muted/50 transition-colors">
                            <MediaCover
                              src={title.coverUrl}
                              alt={title.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <MediaBadge type={title.mediaType} size="sm" />
                              </div>
                              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {title.title}
                              </p>
                              {title.creator && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {title.creator}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              }

              const { review } = item;
              const title = review.expand?.title;
              const group = title?.expand?.group;
              const reviewer = review.expand?.user;
              const reviewerName = reviewer?.name || reviewer?.email || "Member";
              const initials = reviewerName.slice(0, 2).toUpperCase();

              return (
                <Link
                  key={`r-${review.id}`}
                  href={group ? `/groups/${group.id}` : "#"}
                  className="group block"
                >
                  <Card className="border-border/70 hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-xs">
                    <CardContent className="p-4 flex items-start gap-3 sm:gap-4">
                      <Avatar size="sm" className="ring-1 ring-border shrink-0 mt-0.5">
                        {reviewer?.avatarUrl && <AvatarImage src={reviewer.avatarUrl} alt={reviewerName} />}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{reviewerName}</span>
                            <span>reviewed</span>
                            <span className="font-semibold text-foreground line-clamp-1">{title?.title}</span>
                            {group && (
                              <>
                                <span>in</span>
                                <Badge variant="secondary" className="text-[10px] font-medium py-0">
                                  {group.name}
                                </Badge>
                              </>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatRelativeTime(review.createdAt)}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5 group-hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`size-3.5 ${
                                  i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                            <span className="text-xs font-semibold text-foreground ml-1.5">
                              {review.rating}.0 / 5.0
                            </span>
                          </div>

                          {review.reviewText && (
                            <p className="text-xs text-muted-foreground leading-relaxed italic">
                              &ldquo;{review.reviewText}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Rss}
            title="No activity yet"
            description="When members in your circles propose titles or write reviews, they will appear here in chronological order."
          />
        )}
      </div>
    </AppShell>
  );
}
