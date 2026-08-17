import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CreateGroupCard, JoinGroupCard } from "@/components/group-forms";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { createGroup, joinGroup } from "@/lib/actions/groups";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import type {
  GroupMembersResponse,
  GroupsResponse,
  TitlesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export default async function GroupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getServerTranslations();
  const pb = await getSuperuserClient();
  let memberships: GroupMembersResponse<{ group?: GroupsResponse }>[] = [];
  let userRecord: UsersResponse | null = null;

  try {
    const [fetchedMemberships, fetchedUser] = await Promise.all([
      pb
        .collection("group_members")
        .getFullList<GroupMembersResponse<{ group?: GroupsResponse }>>({
          filter: pb.filter("user = {:userId}", { userId: session.id }),
          expand: "group",
        }),
      pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null),
    ]);
    memberships = fetchedMemberships;
    userRecord = fetchedUser;
  } catch (err) {
    console.error("[GroupsPage] Failed to fetch memberships:", err);
  }

  const groupIds = memberships
    .map((m) => m.group)
    .filter((id): id is string => Boolean(id));

  // Fetch title stats for user's groups
  let titlesByGroup: Record<string, { proposed: number; consumed: number }> = {};
  if (groupIds.length > 0) {
    try {
      const filterParams = Object.fromEntries(groupIds.map((id, i) => [`g${i}`, id]));
      const filterExpr = `(${groupIds.map((_, i) => `group = {:g${i}}`).join(" || ")})`;
      const allTitles = await pb.collection("titles").getFullList<TitlesResponse>({
        filter: pb.filter(filterExpr, filterParams),
        fields: "id,group,status",
      });

      titlesByGroup = allTitles.reduce((acc, t) => {
        if (!acc[t.group]) acc[t.group] = { proposed: 0, consumed: 0 };
        if (t.status === "proposed") acc[t.group].proposed += 1;
        else if (t.status === "consumed") acc[t.group].consumed += 1;
        return acc;
      }, {} as Record<string, { proposed: number; consumed: number }>);
    } catch (err) {
      console.error("[GroupsPage] Failed to fetch title stats:", err);
    }
  }

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell user={currentUser} maxWidth="wide" title={t.groups.title}>
      <div className="flex flex-col gap-8">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t.groups.yourCircles}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t.groups.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full border">
              {t.groups.groupCount.replace("{n}", String(memberships.length))}
            </span>
          </div>
        </div>

        {/* Groups Grid */}
        {memberships.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships.map((membership) => {
              const group = membership.expand?.group;
              if (!group) return null;
              const stats = titlesByGroup[group.id] ?? { proposed: 0, consumed: 0 };
              const isOwner = membership.role === "owner";

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="group block"
                >
                  <Card className="h-full flex flex-col justify-between border-border/70 hover:border-primary/50 hover:shadow-md transition-all duration-200 group-active:scale-[0.99]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
                          {group.name}
                        </CardTitle>
                        <Badge
                          variant={isOwner ? "default" : "secondary"}
                          className="shrink-0 text-[10px] uppercase tracking-wider font-semibold"
                        >
                          {isOwner ? t.groups.ownerBadge : t.groups.memberBadge}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs flex items-center gap-2 mt-1">
                        <span>{t.groups.codeLabel}:</span>
                        <CopyInviteButton code={group.inviteCode} />
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <span className="text-primary font-bold">{stats.proposed}</span> {t.media.upNext}
                          </span>
                          <span>&middot;</span>
                          <span className="font-medium text-muted-foreground">
                            {stats.consumed} {t.media.consumed}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors font-medium">
                          <span>{t.common.open}</span>
                          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={t.groups.noCirclesTitle}
            description={t.groups.noCirclesDesc}
          />
        )}

        {/* Create & Join Actions Section */}
        <div className="space-y-3 pt-4 border-t">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">
            {t.groups.createOrJoin}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CreateGroupCard onCreate={createGroup} />
            <JoinGroupCard onJoin={joinGroup} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
