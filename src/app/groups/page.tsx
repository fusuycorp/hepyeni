import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CreateGroupCard, JoinGroupCard } from "@/components/group-forms";
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
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm text-muted-foreground underline"
          >
            Profile
          </Link>
          {session.isAdmin && (
            <Link
              href="/admin"
              className="text-sm text-muted-foreground underline"
            >
              Admin
            </Link>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {memberships.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {memberships.map((membership) => {
            const group = membership.expand?.group;
            if (!group) return null;
            return (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`}>
                  <Card size="sm" className="px-4 transition-colors hover:bg-muted/50">
                    <div className="font-medium">{group.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      Invite code: {group.inviteCode}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="You're not in any groups yet"
          description="Create a group for your friends, or join one with an invite code."
        />
      )}

      <CreateGroupCard onCreate={createGroup} />
      <JoinGroupCard onJoin={joinGroup} />
    </div>
  );
}
