import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { groups, titles } from "@/db/schema";
import {
  adminDeleteReview,
  adminDeleteTitle,
  adminRemoveGroupMember,
} from "@/lib/actions/admin";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: {
      members: { with: { user: true } },
    },
  });
  if (!group) notFound();

  const groupTitles = await db.query.titles.findMany({
    where: eq(titles.groupId, groupId),
    with: {
      addedByUser: true,
      votes: true,
      reviews: { with: { user: true } },
    },
    orderBy: desc(titles.createdAt),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-zinc-500">
          Invite code: <span className="font-mono">{group.inviteCode}</span>
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">
          Members ({group.members.length})
        </h2>
        <ul className="flex flex-col gap-1">
          {group.members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-800"
            >
              <span className="flex-1">
                {m.user.name ?? m.user.email}
                {m.role === "owner" && (
                  <span className="ml-2 text-xs text-zinc-500">owner</span>
                )}
              </span>
              <form
                action={adminRemoveGroupMember.bind(
                  null,
                  groupId,
                  m.userId,
                )}
              >
                <button
                  type="submit"
                  className="text-xs font-medium text-red-600 underline dark:text-red-400"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">
          Titles ({groupTitles.length})
        </h2>
        <ul className="flex flex-col gap-3">
          {groupTitles.map((title) => {
            const score = title.votes.reduce(
              (acc, v) => acc + (v.value === "up" ? 1 : -1),
              0,
            );
            return (
              <li
                key={title.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{title.title}</p>
                    <p className="text-xs text-zinc-500">
                      {MEDIA_TYPE_LABELS[title.mediaType]} · {title.status} ·
                      score {score} · added by{" "}
                      {title.addedByUser.name ?? title.addedByUser.email}
                    </p>
                  </div>
                  <form
                    action={adminDeleteTitle.bind(null, title.id, groupId)}
                  >
                    <button
                      type="submit"
                      className="text-xs font-medium text-red-600 underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </form>
                </div>

                {title.reviews.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    {title.reviews.map((review) => (
                      <li
                        key={review.id}
                        className="flex items-center gap-2 text-xs text-zinc-500"
                      >
                        <span className="flex-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {review.user.name ?? review.user.email}
                          </span>{" "}
                          rated it {review.rating}/5
                          {review.reviewText ? `: ${review.reviewText}` : ""}
                        </span>
                        <form
                          action={adminDeleteReview.bind(
                            null,
                            review.id,
                            groupId,
                          )}
                        >
                          <button
                            type="submit"
                            className="font-medium text-red-600 underline dark:text-red-400"
                          >
                            Delete
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {groupTitles.length === 0 && (
            <li className="text-sm text-zinc-500">No titles yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
