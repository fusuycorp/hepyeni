import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { banUser, setUserAdmin, unbanUser } from "@/lib/actions/admin";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getInitials } from "@/lib/format";
import { getServerTranslations, getLocale } from "@/lib/i18n/server";
import type { UsersResponse } from "@/types/pocketbase-types";

const USERS_PER_PAGE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, Number(pageParam) || 1);

  const pb = await getSuperuserClient();
  // P5 (perf): paginated getList instead of an unbounded getFullList of the
  // whole users table; totalItems doubles as the count for the header badge.
  const [result, t, locale] = await Promise.all([
    pb.collection("users").getList<UsersResponse>(currentPage, USERS_PER_PAGE, {
      sort: "-created",
    }),
    getServerTranslations(),
    getLocale(),
  ]);
  const allUsers = result.items;
  const totalUsers = result.totalItems;
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.admin.userManagement}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t.admin.userManagementDesc}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {t.admin.totalUsersCount.replace("{n}", String(totalUsers))}
        </Badge>
      </div>

      <div className="space-y-2.5">
        {allUsers.map((user) => {
          const isSelf = user.id === session.id;
          const userName = user.name || user.email;
          const userInitials = getInitials(user.name, user.email);

          return (
            <Card
              key={user.id}
              className="border-border/70 shadow-2xs hover:border-border transition-colors"
            >
              <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar size="sm" className="ring-1 ring-border shrink-0">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={userName} />}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {userName}
                      </span>
                      {user.isAdmin && (
                        <Badge variant="default" className="text-[10px] py-0 gap-1">
                          <Shield className="size-2.5" />
                          <span>{t.admin.adminBadge}</span>
                        </Badge>
                      )}
                      {user.bannedAt && (
                        <Badge variant="destructive" className="text-[10px] py-0 gap-1">
                          <Ban className="size-2.5" />
                          <span>{t.admin.banned}</span>
                        </Badge>
                      )}
                      {isSelf && (
                        <span className="text-[10px] text-muted-foreground font-mono">{t.admin.currentUserTag}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {user.email} &middot; {t.admin.registeredLabel}: {new Date(user.created).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US")}
                    </p>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <form
                      action={async () => {
                        "use server";
                        await setUserAdmin(user.id, !user.isAdmin);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="xs"
                        className="text-xs h-7"
                      >
                        {user.isAdmin ? t.admin.revokeAdmin : t.admin.makeAdmin}
                      </Button>
                    </form>

                    {user.bannedAt ? (
                      <form
                        action={async () => {
                          "use server";
                          await unbanUser(user.id);
                        }}
                      >
                        <Button
                          type="submit"
                          variant="secondary"
                          size="xs"
                          className="text-xs h-7"
                        >
                          {t.admin.unban}
                        </Button>
                      </form>
                    ) : (
                      <ConfirmActionButton
                        triggerLabel={t.admin.ban}
                        triggerVariant="destructive"
                        variant="destructive"
                        size="xs"
                        className="text-xs h-7"
                        title={t.admin.banConfirmTitle.replace("{name}", userName)}
                        description={t.admin.banConfirmDesc}
                        confirmLabel={t.admin.ban}
                        pendingLabel={t.common.working}
                        onConfirm={banUser.bind(null, user.id)}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
                href={`/admin/users?page=${currentPage - 1}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span>{t.common.previous}</span>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin/users?page=${currentPage + 1}`}
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
