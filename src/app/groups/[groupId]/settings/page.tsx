import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { RenameGroupForm } from "@/components/rename-group-form";
import {
  deleteGroup,
  leaveGroup,
  regenerateInviteCode,
  removeMember,
  renameGroup,
} from "@/lib/actions/groups";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  GroupsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { groupId } = await params;
  const pb = await getSuperuserClient();

  let membership: GroupMembersResponse;
  let group: GroupsResponse;
  try {
    membership = await pb
      .collection("group_members")
      .getFirstListItem<GroupMembersResponse>(
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

  const isOwner = membership.role === "owner";

  const members = await pb
    .collection("group_members")
    .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
      filter: pb.filter("group = {:groupId}", { groupId }),
      expand: "user",
      sort: "joinedAt",
    });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Button
          render={<Link href={`/groups/${groupId}`} />}
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground"
        >
          &larr; Back
        </Button>
        <h1 className="text-lg font-semibold">{group.name} settings</h1>
      </header>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group name</CardTitle>
          </CardHeader>
          <CardContent>
            <RenameGroupForm
              defaultName={group.name}
              onRename={renameGroup.bind(null, groupId)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite code</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm">{group.inviteCode}</span>
          {isOwner && (
            <ConfirmActionButton
              triggerLabel="Regenerate"
              triggerVariant="outline"
              variant="default"
              title="Regenerate the invite code?"
              description="The current code will stop working immediately — anyone who hasn't joined yet will need the new one."
              confirmLabel="Regenerate"
              pendingLabel="Regenerating…"
              onConfirm={regenerateInviteCode.bind(null, groupId)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {m.expand?.user?.name ?? m.expand?.user?.email}
                  {m.role === "owner" && <Badge variant="secondary">owner</Badge>}
                </span>
                {isOwner && m.id !== membership.id && (
                  <ConfirmActionButton
                    triggerLabel="Remove"
                    triggerVariant="ghost"
                    size="xs"
                    title={`Remove ${m.expand?.user?.name ?? m.expand?.user?.email}?`}
                    description="They'll need a new invite code to rejoin this group."
                    confirmLabel="Remove"
                    pendingLabel="Removing…"
                    onConfirm={removeMember.bind(null, groupId, m.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {isOwner && members.length > 1
                ? "Remove the other members first — an owner can't leave a group that still has people in it."
                : "Leave this group."}
            </p>
            <ConfirmActionButton
              triggerLabel="Leave"
              triggerVariant="outline"
              title="Leave this group?"
              description="You'll need a new invite code to rejoin."
              confirmLabel="Leave"
              pendingLabel="Leaving…"
              redirectTo="/groups"
              onConfirm={leaveGroup.bind(null, groupId)}
            />
          </div>
          {isOwner && (
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                Delete this group and everything in it — titles, votes, and
                reviews, for every member.
              </p>
              <ConfirmActionButton
                triggerLabel="Delete group"
                title="Delete this group?"
                description="This permanently removes the group along with every title, vote, and review in it. This can't be undone."
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                redirectTo="/groups"
                onConfirm={deleteGroup.bind(null, groupId)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
