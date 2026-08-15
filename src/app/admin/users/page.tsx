import { redirect } from "next/navigation";
import { banUser, setUserAdmin, unbanUser } from "@/lib/actions/admin";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  const allUsers = await pb
    .collection("users")
    .getFullList<UsersResponse>({ sort: "-created" });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Users ({allUsers.length})</h1>

      <ul className="flex flex-col gap-2">
        {allUsers.map((user) => {
          const isSelf = user.id === session.id;
          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {user.name ?? user.email}
                  {user.isAdmin && (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      admin
                    </span>
                  )}
                  {user.bannedAt && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                      banned
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {user.email} · joined {user.created.slice(0, 10)}
                </p>
              </div>

              {!isSelf && (
                <div className="flex gap-2">
                  <form
                    action={setUserAdmin.bind(null, user.id, !user.isAdmin)}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
                    >
                      {user.isAdmin ? "Remove admin" : "Make admin"}
                    </button>
                  </form>
                  <form
                    action={
                      user.bannedAt
                        ? unbanUser.bind(null, user.id)
                        : banUser.bind(null, user.id)
                    }
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
                    >
                      {user.bannedAt ? "Unban" : "Ban"}
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
