import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { createGroup, joinGroup } from "@/lib/actions/groups";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  GroupsResponse,
} from "@/types/pocketbase-types";

export default async function GroupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  const memberships = await pb
    .collection("group_members")
    .getFullList<GroupMembersResponse<{ group?: GroupsResponse }>>({
      filter: pb.filter("user = {:userId}", { userId: session.id }),
      expand: "group",
    });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your groups</h1>
        <div className="flex items-center gap-3">
          {session.isAdmin && (
            <Link href="/admin" className="text-sm text-zinc-500 underline">
              Admin
            </Link>
          )}
          <form action={signOutAction}>
            <button className="text-sm text-zinc-500 underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {memberships.map((membership) => {
          const group = membership.expand?.group;
          if (!group) return null;
          return (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="block rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <div className="font-medium">{group.name}</div>
                <div className="text-xs text-zinc-500">
                  Invite code: {group.inviteCode}
                </div>
              </Link>
            </li>
          );
        })}
        {memberships.length === 0 && (
          <li className="text-sm text-zinc-500">
            You&apos;re not in any groups yet.
          </li>
        )}
      </ul>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Create a group</h2>
        <form action={createGroup} className="flex gap-2">
          <input
            name="name"
            placeholder="Group name"
            required
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Create
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Join a group</h2>
        <form action={joinGroup} className="flex gap-2">
          <input
            name="code"
            placeholder="Invite code"
            required
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Join
          </button>
        </form>
      </section>
    </div>
  );
}
