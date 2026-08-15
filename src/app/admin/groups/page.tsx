import Link from "next/link";
import { Users, Sparkles, Trash2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyInviteButton } from "@/components/copy-invite-button";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Circle Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Browse all user-created circles, view content stats, or remove inactive/violating groups.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {groups.length} circles
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const memberCount = membersPerGroup.get(group.id) ?? 0;
          const titleCount = titlesPerGroup.get(group.id) ?? 0;
          const creatorName = group.expand?.createdBy?.name || group.expand?.createdBy?.email || "Unknown";

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
                      Created by <span className="font-medium text-foreground">{creatorName}</span>
                    </p>
                  </div>
                  <CopyInviteButton code={group.inviteCode} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      <span>{memberCount}</span>
                    </span>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      <span>{titleCount}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/groups/${group.id}`}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Manage</span>
                      <ArrowRight className="size-3" />
                    </Link>

                    <form action={adminDeleteGroup.bind(null, group.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:bg-destructive/10 size-7"
                        title="Delete Group"
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
            No circles have been created yet.
          </div>
        )}
      </div>
    </div>
  );
}
