import { desc } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";

export default async function AdminDashboardPage() {
  const [allUsers, allGroups, allTitles, allVotes, allReviews, recentGroups] =
    await Promise.all([
      db.query.users.findMany(),
      db.query.groups.findMany(),
      db.query.titles.findMany(),
      db.query.votes.findMany(),
      db.query.reviews.findMany(),
      db.query.groups.findMany({
        orderBy: desc(groups.createdAt),
        limit: 5,
        with: { creator: true },
      }),
    ]);

  const bannedUsers = allUsers.filter((u) => u.bannedAt).length;
  const proposedTitles = allTitles.filter(
    (t) => t.status === "proposed",
  ).length;
  const consumedTitles = allTitles.filter(
    (t) => t.status === "consumed",
  ).length;

  const stats = [
    { label: "Users", value: allUsers.length },
    { label: "Banned users", value: bannedUsers },
    { label: "Groups", value: allGroups.length },
    { label: "Titles proposed", value: proposedTitles },
    { label: "Titles consumed", value: consumedTitles },
    { label: "Votes", value: allVotes.length },
    { label: "Reviews", value: allReviews.length },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-2xl font-semibold tabular-nums">
              {stat.value}
            </p>
            <p className="text-xs text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">
          Recently created groups
        </h2>
        <ul className="flex flex-col gap-1">
          {recentGroups.map((group) => (
            <li
              key={group.id}
              className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <span className="font-medium">{group.name}</span>{" "}
              <span className="text-zinc-500">
                by {group.creator.name ?? group.creator.email}
              </span>
            </li>
          ))}
          {recentGroups.length === 0 && (
            <li className="text-sm text-zinc-500">No groups yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
