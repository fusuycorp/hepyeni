import { notFound, redirect } from "next/navigation";
import { Users, KeyRound, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
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

  const [members, userRecord] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
        sort: "joinedAt",
      }),
    pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null),
  ]);

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell
      user={currentUser}
      maxWidth="default"
      backHref={`/groups/${groupId}`}
      backLabel={group.name}
      title={`${group.name} Settings`}
    >
      <div className="space-y-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Circle Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage circle name, invite codes, member access, and permissions.
          </p>
        </div>

        {/* Group Name Section (Owner only) */}
        {isOwner && (
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Circle Name</CardTitle>
              <CardDescription className="text-xs">
                Update how this circle appears to members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RenameGroupForm
                defaultName={group.name}
                onRename={renameGroup.bind(null, groupId)}
              />
            </CardContent>
          </Card>
        )}

        {/* Invite Code & Sharing Section */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">Invite Code</CardTitle>
                <CardDescription className="text-xs">
                  Share this code with friends to let them join this circle.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <CopyInviteButton code={group.inviteCode} variant="button" />
            </div>

            {isOwner && (
              <ConfirmActionButton
                triggerLabel="Regenerate Code"
                triggerVariant="outline"
                variant="default"
                size="sm"
                title="Regenerate the invite code?"
                description="The current code will stop working immediately — anyone who hasn't joined yet will need the new one."
                confirmLabel="Regenerate"
                pendingLabel="Regenerating…"
                onConfirm={regenerateInviteCode.bind(null, groupId)}
              />
            )}
          </CardContent>
        </Card>

        {/* Member Management Roster */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">Members ({members.length})</CardTitle>
                <CardDescription className="text-xs">
                  All active participants in this circle.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {members.map((m) => {
                const userName = m.expand?.user?.name || m.expand?.user?.email || "Member";
                const userEmail = m.expand?.user?.email;
                const initials = userName.slice(0, 2).toUpperCase();
                const isMemberOwner = m.role === "owner";
                const isSelf = m.id === membership.id;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar size="sm" className="ring-1 ring-border">
                        {m.expand?.user?.avatarUrl && (
                          <AvatarImage src={m.expand?.user?.avatarUrl} alt={userName} />
                        )}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {userName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground font-normal">(you)</span>
                          )}
                        </div>
                        {userEmail && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {userEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMemberOwner ? (
                        <Badge variant="default" className="text-[10px] uppercase tracking-wider font-semibold">
                          Owner
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">
                          Member
                        </Badge>
                      )}

                      {isOwner && !isSelf && (
                        <ConfirmActionButton
                          triggerLabel="Remove"
                          triggerVariant="ghost"
                          size="xs"
                          title={`Remove ${userName}?`}
                          description="They will immediately lose access and need a new invite code to rejoin."
                          confirmLabel="Remove"
                          pendingLabel="Removing…"
                          onConfirm={removeMember.bind(null, groupId, m.id)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <div>
                <CardTitle className="text-sm font-semibold text-destructive">
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-xs">
                  Irreversible actions for this circle.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
              <div>
                <p className="text-xs font-semibold text-foreground">Leave Circle</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isOwner && members.length > 1
                    ? "Remove all other members first — owners cannot leave an active circle with remaining members."
                    : "You will leave this circle. You will need an invite code to rejoin."}
                </p>
              </div>
              <ConfirmActionButton
                triggerLabel="Leave Circle"
                triggerVariant="outline"
                variant="destructive"
                size="sm"
                title="Leave this circle?"
                description="You'll need a valid invite code to rejoin."
                confirmLabel="Leave"
                pendingLabel="Leaving…"
                redirectTo="/groups"
                onConfirm={leaveGroup.bind(null, groupId)}
              />
            </div>

            {isOwner && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
                <div>
                  <p className="text-xs font-semibold text-destructive">Delete Circle</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Permanently delete this circle, all proposed media, votes, and member records.
                  </p>
                </div>
                <ConfirmActionButton
                  triggerLabel="Delete Circle"
                  triggerVariant="destructive"
                  variant="destructive"
                  size="sm"
                  title={`Delete "${group.name}"?`}
                  description="This action cannot be undone. All media, votes, and discussion records will be permanently erased."
                  confirmLabel="Permanently Delete"
                  pendingLabel="Deleting…"
                  redirectTo="/groups"
                  onConfirm={deleteGroup.bind(null, groupId)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
