import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { GroupsResponse, UsersResponse } from "@/types/pocketbase-types";

export default async function AdminDashboardPage() {
  const pb = await getSuperuserClient();

  const [
    usersCount,
    bannedCount,
    groupsCount,
    proposedCount,
    consumedCount,
    votesCount,
    reviewsCount,
    recentGroups,
  ] = await Promise.all([
    pb.collection("users").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("users")
      .getList(1, 1, { filter: 'bannedAt != ""' })
      .then((r) => r.totalItems),
    pb.collection("groups").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("titles")
      .getList(1, 1, { filter: 'status = "proposed"' })
      .then((r) => r.totalItems),
    pb
      .collection("titles")
      .getList(1, 1, { filter: 'status = "consumed"' })
      .then((r) => r.totalItems),
    pb.collection("votes").getList(1, 1).then((r) => r.totalItems),
    pb.collection("reviews").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("groups")
      .getList<GroupsResponse<{ createdBy?: UsersResponse }>>(1, 5, {
        sort: "-createdAt",
        expand: "createdBy",
      })
      .then((r) => r.items),
  ]);

  const stats = [
    { label: "Users", value: usersCount },
    { label: "Banned users", value: bannedCount },
    { label: "Groups", value: groupsCount },
    { label: "Titles proposed", value: proposedCount },
    { label: "Titles consumed", value: consumedCount },
    { label: "Votes", value: votesCount },
    { label: "Reviews", value: reviewsCount },
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
                by{" "}
                {group.expand?.createdBy?.name ??
                  group.expand?.createdBy?.email}
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
