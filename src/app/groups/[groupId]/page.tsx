import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { markConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
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

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { groupId } = await params;
  const pb = await getSuperuserClient();

  let group: GroupsResponse;
  try {
    await pb
      .collection("group_members")
      .getFirstListItem(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId: session.id,
        }),
      );
    group = await pb.collection("groups").getOne<GroupsResponse>(groupId);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  const [members, groupTitles] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      }),
    pb.collection("titles").getFullList<TitlesResponse<TitleExpand>>({
      filter: pb.filter("group = {:groupId}", { groupId }),
      expand: "addedBy,votes_via_title,reviews_via_title.user",
      sort: "-createdAt",
    }),
  ]);

  const withScore = groupTitles.map((title) => {
    const votes = title.expand?.votes_via_title ?? [];
    const score = votes.reduce(
      (acc, v) => acc + (v.value === "up" ? 1 : -1),
      0,
    );
    const userVote = votes.find((v) => v.user === session.id)?.value;
    return { ...title, score, userVote };
  });

  const proposed = withScore
    .filter((t) => t.status === "proposed")
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const consumed = withScore.filter((t) => t.status === "consumed");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-zinc-500">
          Invite code: <span className="font-mono">{group.inviteCode}</span>
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">
          Members ({members.length})
        </h2>
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.id} className="text-sm">
              {m.expand?.user?.name ?? m.expand?.user?.email}
              {m.role === "owner" && (
                <span className="ml-2 text-xs text-zinc-500">owner</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">
            Up next ({proposed.length})
          </h2>
          <Link
            href={`/groups/${groupId}/add`}
            className="text-sm font-medium underline"
          >
            + Add a title
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {proposed.map((title) => (
            <li
              key={title.id}
              className="flex gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
                <form action={voteOnTitle.bind(null, title.id, groupId, "up")}>
                  <button
                    type="submit"
                    aria-label="Upvote"
                    className={`rounded px-1.5 py-0.5 leading-none ${
                      title.userVote === "up"
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  >
                    ▲
                  </button>
                </form>
                <span className="text-xs font-medium tabular-nums">
                  {title.score}
                </span>
                <form
                  action={voteOnTitle.bind(null, title.id, groupId, "down")}
                >
                  <button
                    type="submit"
                    aria-label="Downvote"
                    className={`rounded px-1.5 py-0.5 leading-none ${
                      title.userVote === "down"
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  >
                    ▼
                  </button>
                </form>
              </div>
              {title.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={title.coverUrl}
                  alt=""
                  className="h-16 w-11 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-11 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
              )}
              <div className="flex flex-1 flex-col justify-center gap-1">
                <p className="text-sm font-medium">{title.title}</p>
                {title.creator && (
                  <p className="text-xs text-zinc-500">{title.creator}</p>
                )}
                <p className="text-xs text-zinc-400">
                  {MEDIA_TYPE_LABELS[title.mediaType]} · added by{" "}
                  {title.expand?.addedBy?.name ?? title.expand?.addedBy?.email}
                </p>
                <form action={markConsumed.bind(null, title.id, groupId)}>
                  <button
                    type="submit"
                    className="text-xs font-medium text-zinc-500 underline underline-offset-2"
                  >
                    Mark as consumed
                  </button>
                </form>
              </div>
            </li>
          ))}
          {proposed.length === 0 && (
            <li className="text-sm text-zinc-500">
              Nothing proposed yet — add the first title.
            </li>
          )}
        </ul>
      </section>

      {consumed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-500">
            Consumed ({consumed.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {consumed.map((title) => {
              const reviews = title.expand?.reviews_via_title ?? [];
              const avg = reviews.length
                ? reviews.reduce((acc, r) => acc + r.rating, 0) /
                  reviews.length
                : null;
              const myReview = reviews.find((r) => r.user === session.id);
              const otherReviews = reviews.filter(
                (r) => r.user !== session.id,
              );

              return (
                <li
                  key={title.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex gap-3">
                    {title.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={title.coverUrl}
                        alt=""
                        className="h-16 w-11 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-16 w-11 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    <div className="flex flex-1 flex-col justify-center">
                      <p className="text-sm font-medium">{title.title}</p>
                      {title.creator && (
                        <p className="text-xs text-zinc-500">
                          {title.creator}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400">
                        {MEDIA_TYPE_LABELS[title.mediaType]}
                        {avg !== null &&
                          ` · ★ ${avg.toFixed(1)} (${reviews.length} review${
                            reviews.length === 1 ? "" : "s"
                          })`}
                      </p>
                    </div>
                  </div>

                  <form
                    action={submitReview.bind(null, title.id, groupId)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <label htmlFor={`rating-${title.id}`}>
                        Your rating
                      </label>
                      <select
                        id={`rating-${title.id}`}
                        name="rating"
                        defaultValue={myReview?.rating ?? 5}
                        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-transparent"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      name="reviewText"
                      defaultValue={myReview?.reviewText ?? ""}
                      placeholder="Thoughts? (optional)"
                      rows={2}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-transparent"
                    />
                    <button
                      type="submit"
                      className="self-start rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
                    >
                      {myReview ? "Update review" : "Save review"}
                    </button>
                  </form>

                  {otherReviews.length > 0 && (
                    <ul className="flex flex-col gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                      {otherReviews.map((r) => (
                        <li key={r.id} className="text-xs text-zinc-500">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {r.expand?.user?.name ?? r.expand?.user?.email}
                          </span>{" "}
                          rated it {r.rating}/5
                          {r.reviewText ? `: ${r.reviewText}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
