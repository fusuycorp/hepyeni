import { notFound, redirect } from "next/navigation";
import { Users, KeyRound, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { InlineTextForm } from "@/components/inline-text-form";
import { GuestSettingsForm } from "./guest-settings-form";
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
import { getDisplayName, getInitials } from "@/lib/format";
import { getServerTranslations } from "@/lib/i18n/server";
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
  const t = await getServerTranslations();

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
      title={`${group.name} ${t.groups.settings}`}
    >
      <div className="space-y-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.groups.circleSettingsTitle}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t.groups.settingsSubtitle}
          </p>
        </div>

        {/* Group Name Section (Owner only) */}
        {isOwner && (
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.groups.circleNameLabel}</CardTitle>
              <CardDescription className="text-xs">
                {t.groups.groupNameSectionDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InlineTextForm
                defaultValue={group.name}
                onSubmit={renameGroup.bind(null, groupId)}
                successMessage={t.groups.nameUpdated}
                errorMessage={t.groups.nameUpdateFailed}
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
                <CardTitle className="text-sm font-semibold">{t.groups.inviteCodeText}</CardTitle>
                <CardDescription className="text-xs">
                  {t.groups.inviteCodeSectionDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <CopyInviteButton code={group.inviteCode} variant="button" mode="code" />
              <CopyInviteButton code={group.inviteCode} variant="button" mode="link" />
            </div>


            {isOwner && (
              <ConfirmActionButton
                triggerLabel={t.groups.regenerateInviteCode}
                triggerVariant="outline"
                variant="default"
                size="sm"
                title={t.groups.regenerateConfirmTitle}
                description={t.groups.regenerateConfirmDesc}
                confirmLabel={t.groups.regenerateConfirm}
                pendingLabel={t.groups.regenerating}
                onConfirm={regenerateInviteCode.bind(null, groupId)}
              />
            )}
          </CardContent>
        </Card>

        {/* Public Access & Guest Permissions (Owner only) */}
        {isOwner && (
          <GuestSettingsForm
            groupId={groupId}
            initialIsPublic={group.isPublic}
            initialSettings={group.guestSettings}
          />
        )}

        {/* Member Management Roster */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">{t.groups.members} ({members.length})</CardTitle>
                <CardDescription className="text-xs">
                  {t.groups.membersSectionDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {members.map((m) => {
                const userName = getDisplayName(m.expand?.user);
                const userEmail = m.expand?.user?.email;
                const initials = getInitials(m.expand?.user?.name, m.expand?.user?.email);
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
                            <span className="text-[10px] text-muted-foreground font-normal">{t.groups.youParen}</span>
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
                          {t.groups.ownerBadge}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">
                          {t.groups.memberBadge}
                        </Badge>
                      )}

                      {isOwner && !isSelf && (
                        <ConfirmActionButton
                          triggerLabel={t.groups.removeButton}
                          triggerVariant="ghost"
                          size="xs"
                          title={t.groups.removeMemberConfirmTitle.replace("{name}", userName)}
                          description={t.groups.removeMemberDesc}
                          confirmLabel={t.groups.removeButton}
                          pendingLabel={t.groups.removing}
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
                  {t.groups.dangerZone}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t.groups.dangerZoneDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
              <div>
                <p className="text-xs font-semibold text-foreground">{t.groups.leaveCircleTitle}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isOwner && members.length > 1
                    ? t.groups.leaveOwnerBlocked
                    : t.groups.leaveCircleDesc}
                </p>
              </div>
              <ConfirmActionButton
                triggerLabel={t.groups.leaveCircleButton}
                triggerVariant="outline"
                variant="destructive"
                size="sm"
                title={t.groups.leaveCircleTitle}
                description={t.groups.leaveCircleDesc}
                confirmLabel={t.groups.leaveCircleButton}
                pendingLabel={t.groups.leaving}
                redirectTo="/groups"
                onConfirm={leaveGroup.bind(null, groupId)}
              />
            </div>

            {isOwner && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
                <div>
                  <p className="text-xs font-semibold text-destructive">{t.groups.deleteCircleTitle}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.groups.deleteCircleDesc}
                  </p>
                </div>
                <ConfirmActionButton
                  triggerLabel={t.groups.deleteCircleTitle}
                  triggerVariant="destructive"
                  variant="destructive"
                  size="sm"
                  title={t.groups.deleteConfirmTitle.replace("{name}", group.name)}
                  description={t.groups.deleteCircleDesc}
                  confirmLabel={t.common.deletePermanently}
                  pendingLabel={t.common.deleting}
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
