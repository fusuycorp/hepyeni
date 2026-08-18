import Link from "next/link";
import { Users, Sparkles, Trash2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { adminDeleteGroup } from "@/lib/actions/admin";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import type { GroupsResponse, UsersResponse } from "@/types/pocketbase-types";

export default async function AdminGroupsPage() {
  const pb = await getSuperuserClient();
  const t = await getServerTranslations();

  const groups = await pb
    .collection("groups")
    .getFullList<GroupsResponse<{ createdBy?: UsersResponse }>>({
      sort: "-createdAt",
      expand: "createdBy",
    });

  // P5 (perf): per-group count queries (getList(1,1).totalItems) instead of
  // scanning the entire group_members and titles tables into memory and
  // tallying them in JS.
  const membersPerGroup = new Map<string, number>();
  const titlesPerGroup = new Map<string, number>();
  await Promise.all(
    groups.map(async (group) => {
      const [memberPage, titlePage] = await Promise.all([
        pb.collection("group_members").getList(1, 1, {
          filter: pb.filter("group = {:groupId}", { groupId: group.id }),
        }),
        pb.collection("titles").getList(1, 1, {
          filter: pb.filter("group = {:groupId}", { groupId: group.id }),
        }),
      ]);
      membersPerGroup.set(group.id, memberPage.totalItems);
      titlesPerGroup.set(group.id, titlePage.totalItems);
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.admin.circleManagement}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t.admin.circleManagementDesc}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {t.groups.groupCount.replace("{n}", String(groups.length))}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const memberCount = membersPerGroup.get(group.id) ?? 0;
          const titleCount = titlesPerGroup.get(group.id) ?? 0;
          const creatorName = group.expand?.createdBy?.name || group.expand?.createdBy?.email || t.common.unknown;

          return (
            <Card
              key={group.id}
              className="border-border/70 shadow-2xs hover:border-border transition-colors flex flex-col justify-between"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Link
                      href={`/admin/groups/${group.id}`}
                      className="text-base font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {group.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t.admin.createdBy}: <span className="font-medium text-foreground">{creatorName}</span>
                    </p>
                  </div>
                  <CopyInviteButton code={group.inviteCode} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      <span>{memberCount} {t.groups.members}</span>
                    </span>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      <span>{titleCount} {t.admin.mediaCountLabel}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/groups/${group.id}`}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <span>{t.common.manage}</span>
                      <ArrowRight className="size-3" />
                    </Link>

                    <form
                      action={async () => {
                        "use server";
                        await adminDeleteGroup(group.id);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:bg-destructive/10 size-7"
                        title={t.groups.deleteCircleTitle}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {groups.length === 0 && (
          <div className="col-span-full p-8 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
            {t.admin.noCirclesYet}
          </div>
        )}
      </div>
    </div>
  );
}
