import { redirect } from "next/navigation";
import { Shield, Ban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { banUser, setUserAdmin, unbanUser } from "@/lib/actions/admin";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getInitials } from "@/lib/format";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  const allUsers = await pb
    .collection("users")
    .getFullList<UsersResponse>({ sort: "-created" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Kullanıcı Yönetimi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kullanıcı hesaplarını inceleyin, yönetici yetkileri atayın veya hesapları askıya alın.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {allUsers.length} toplam kullanıcı
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
                          <span>Yönetici</span>
                        </Badge>
                      )}
                      {user.bannedAt && (
                        <Badge variant="destructive" className="text-[10px] py-0 gap-1">
                          <Ban className="size-2.5" />
                          <span>Yasaklı</span>
                        </Badge>
                      )}
                      {isSelf && (
                        <span className="text-[10px] text-muted-foreground font-mono">(Mevcut Kullanıcı)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {user.email} &middot; Kayıt: {new Date(user.created).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <form action={setUserAdmin.bind(null, user.id, !user.isAdmin)}>
                      <Button
                        type="submit"
                        variant="outline"
                        size="xs"
                        className="text-xs h-7"
                      >
                        {user.isAdmin ? "Yöneticiliği Kaldır" : "Yönetici Yap"}
                      </Button>
                    </form>

                    <form
                      action={
                        user.bannedAt
                          ? unbanUser.bind(null, user.id)
                          : banUser.bind(null, user.id)
                      }
                    >
                      <Button
                        type="submit"
                        variant={user.bannedAt ? "secondary" : "destructive"}
                        size="xs"
                        className="text-xs h-7"
                      >
                        {user.bannedAt ? "Yasağı Kaldır" : "Kullanıcıyı Yasakla"}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
