import Link from "next/link";
import { adminDeleteGroup } from "@/lib/actions/admin";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  GroupsResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export default async function AdminGroupsPage() {
  const pb = await getSuperuserClient();

  const groups = await pb
    .collection("groups")
    .getFullList<GroupsResponse<{ createdBy?: UsersResponse }>>({
      sort: "-createdAt",
      expand: "createdBy",
    });

  const [memberCounts, titleCounts] = await Promise.all([
    pb.collection("group_members").getFullList<GroupMembersResponse>(),
    pb.collection("titles").getFullList<TitlesResponse>(),
  ]);

  const countBy = (rows: { group: string }[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    return counts;
  };
  const membersPerGroup = countBy(memberCounts);
  const titlesPerGroup = countBy(titleCounts);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Groups ({groups.length})</h1>

      <ul className="flex flex-col gap-2">
        {groups.map((group) => {
          const memberCount = membersPerGroup.get(group.id) ?? 0;
          const titleCount = titlesPerGroup.get(group.id) ?? 0;
          return (
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
                  {memberCount} member{memberCount === 1 ? "" : "s"} ·{" "}
                  {titleCount} title{titleCount === 1 ? "" : "s"} · created by{" "}
                  {group.expand?.createdBy?.name ??
                    group.expand?.createdBy?.email}{" "}
                  · invite code{" "}
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
          );
        })}
        {groups.length === 0 && (
          <li className="text-sm text-zinc-500">No groups yet.</li>
        )}
      </ul>
    </div>
  );
}
