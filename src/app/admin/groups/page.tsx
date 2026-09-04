import Link from "next/link";
import { Users, Sparkles, Trash2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { adminDeleteGroup } from "@/lib/actions/admin";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import { buildIdListFilter, countByGroup, parsePageParam } from "@/lib/admin-groups";
import type { GroupsResponse, UsersResponse } from "@/types/pocketbase-types";

const GROUPS_PER_PAGE = 25;

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const pb = await getSuperuserClient();
  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

  const [groupPage, t] = await Promise.all([
    pb
      .collection("groups")
      .getList<GroupsResponse<{ createdBy?: UsersResponse }>>(currentPage, GROUPS_PER_PAGE, {
        sort: "-createdAt",
        expand: "createdBy",
      }),
    getServerTranslations(),
  ]);
  const groups = groupPage.items;
  const totalGroups = groupPage.totalItems;
  const totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PER_PAGE));

  // M-2 (perf): the member/title tallies come from ONE lean, group-filtered
  // query per collection (fields: "group", bounded to this page's groups)
  // instead of 2N per-group getList(1,1) count round trips.
  const groupIds = groups.map((g) => g.id);
  const [memberRows, titleRows] = await Promise.all([
    groupIds.length > 0
      ? pb
          .collection("group_members")
          .getFullList<{ group: string }>({ filter: buildIdListFilter("group", groupIds), fields: "group" })
      : Promise.resolve([]),
    groupIds.length > 0
      ? pb
          .collection("titles")
          .getFullList<{ group: string }>({ filter: buildIdListFilter("group", groupIds), fields: "group" })
      : Promise.resolve([]),
  ]);
  const membersPerGroup = countByGroup(memberRows);
  const titlesPerGroup = countByGroup(titleRows);

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
          {t.groups.groupCount.replace("{n}", String(totalGroups))}
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

                    <ConfirmActionButton
                      triggerLabel={<Trash2 className="size-3.5" />}
                      triggerTitle={t.groups.deleteCircleTitle}
                      triggerVariant="ghost"
                      variant="destructive"
                      size="icon-xs"
                      className="text-destructive hover:bg-destructive/10 size-7"
                      title={t.groups.deleteConfirmTitle.replace("{name}", group.name)}
                      description={t.groups.deleteCircleDesc}
                      confirmLabel={t.common.deletePermanently}
                      pendingLabel={t.common.deleting}
                      onConfirm={adminDeleteGroup.bind(null, group.id)}
                    />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
          <span>
            {t.common.pageOf
              .replace("{current}", String(currentPage))
              .replace("{total}", String(totalPages))}
          </span>
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Link
                href={`/admin/groups?page=${currentPage - 1}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span>{t.common.previous}</span>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin/groups?page=${currentPage + 1}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-muted transition-colors"
              >
                <span>{t.common.next}</span>
                <ChevronRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
