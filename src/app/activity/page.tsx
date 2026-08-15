import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { MediaCover } from "@/components/media-cover";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
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

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();

  const memberships = await pb
    .collection("group_members")
    .getFullList<GroupMembersResponse>({
      filter: pb.filter("user = {:userId}", { userId: session.id }),
    });
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
          20,
          { filter: titleGroupFilter, expand: "group,addedBy", sort: "-createdAt" },
        ),
      pb
        .collection("reviews")
        .getList<
          ReviewsResponse<{
            title?: TitlesResponse<{ group?: GroupsResponse }>;
            user?: UsersResponse;
          }>
        >(1, 20, {
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 pb-24">
      <h1 className="text-xl font-semibold">Activity</h1>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 25).map((item) => {
            if (item.kind === "proposed") {
              const { title } = item;
              const group = title.expand?.group;
              return (
                <li key={`t-${title.id}`}>
                  <Link href={group ? `/groups/${group.id}` : "#"}>
                    <Card size="sm" className="flex-row items-center gap-3 px-3">
                      <MediaCover src={title.coverUrl} />
                      <p className="flex-1 text-sm">
                        <span className="font-medium">
                          {title.expand?.addedBy?.name ??
                            title.expand?.addedBy?.email}
                        </span>{" "}
                        proposed{" "}
                        <span className="font-medium">{title.title}</span>
                        {group && <> in {group.name}</>}
                        <span className="block text-xs text-muted-foreground">
                          {MEDIA_TYPE_LABELS[title.mediaType]} ·{" "}
                          {new Date(title.createdAt).toLocaleDateString()}
                        </span>
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            }

            const { review } = item;
            const group = review.expand?.title?.expand?.group;
            return (
              <li key={`r-${review.id}`}>
                <Link href={group ? `/groups/${group.id}` : "#"}>
                  <Card size="sm" className="px-3">
                    <p className="text-sm">
                      <span className="font-medium">
                        {review.expand?.user?.name ?? review.expand?.user?.email}
                      </span>{" "}
                      rated{" "}
                      <span className="font-medium">
                        {review.expand?.title?.title}
                      </span>{" "}
                      {review.rating}/5
                      {group && <> in {group.name}</>}
                    </p>
                    {review.reviewText && (
                      <p className="text-sm text-muted-foreground">
                        {review.reviewText}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No activity yet"
          description="Proposals, votes, and reviews from your groups will show up here."
        />
      )}

      <BottomNav />
    </div>
  );
}
