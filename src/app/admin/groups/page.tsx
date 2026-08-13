import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { adminDeleteGroup } from "@/lib/actions/admin";

export default async function AdminGroupsPage() {
  const allGroups = await db.query.groups.findMany({
    orderBy: desc(groups.createdAt),
    with: {
      creator: true,
      members: true,
      titles: true,
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Groups ({allGroups.length})</h1>

      <ul className="flex flex-col gap-2">
        {allGroups.map((group) => (
          <li
            key={group.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex-1">
              <Link
                href={`/admin/groups/${group.id}`}
                className="font-medium underline"
              >
                {group.name}
              </Link>
              <p className="text-xs text-zinc-500">
                {group.members.length} member
                {group.members.length === 1 ? "" : "s"} ·{" "}
                {group.titles.length} title
                {group.titles.length === 1 ? "" : "s"} · created by{" "}
                {group.creator.name ?? group.creator.email} · invite code{" "}
                <span className="font-mono">{group.inviteCode}</span>
              </p>
            </div>

            <form action={adminDeleteGroup.bind(null, group.id)}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-red-600 dark:border-zinc-700 dark:text-red-400"
              >
                Delete
              </button>
            </form>
          </li>
        ))}
        {allGroups.length === 0 && (
          <li className="text-sm text-zinc-500">No groups yet.</li>
        )}
      </ul>
    </div>
  );
}
