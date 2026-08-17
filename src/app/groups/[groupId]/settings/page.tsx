import { notFound, redirect } from "next/navigation";
import { Users, KeyRound, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { InlineTextForm } from "@/components/inline-text-form";
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
      title={`${group.name} Ayarları`}
    >
      <div className="space-y-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Grup Ayarları
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Grup adını, davet kodunu, üye erişimini ve yetkilerini yönetin.
          </p>
        </div>

        {/* Group Name Section (Owner only) */}
        {isOwner && (
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Grup Adı</CardTitle>
              <CardDescription className="text-xs">
                Bu grubun üyelere nasıl görüneceğini güncelleyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InlineTextForm
                defaultValue={group.name}
                onSubmit={renameGroup.bind(null, groupId)}
                successMessage="Grup adı güncellendi."
                errorMessage="Grup adı güncellenemedi."
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
                <CardTitle className="text-sm font-semibold">Davet Kodu</CardTitle>
                <CardDescription className="text-xs">
                  Arkadaşlarınızın bu gruba katılabilmesi için bu kodu paylaşın.
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
                triggerLabel="Yeni Kod Üret"
                triggerVariant="outline"
                variant="default"
                size="sm"
                title="Davet kodunu yenilemek istiyor musunuz?"
                description="Mevcut kod derhal geçerliliğini yitirecektir — henüz katılmamış olanların yeni koda ihtiyacı olacaktır."
                confirmLabel="Yenile"
                pendingLabel="Yenileniyor…"
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
                <CardTitle className="text-sm font-semibold">Üyeler ({members.length})</CardTitle>
                <CardDescription className="text-xs">
                  Bu gruptaki tüm aktif katılımcılar.
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
                            <span className="text-[10px] text-muted-foreground font-normal">(sen)</span>
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
                          Yönetici
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">
                          Üye
                        </Badge>
                      )}

                      {isOwner && !isSelf && (
                        <ConfirmActionButton
                          triggerLabel="Çıkar"
                          triggerVariant="ghost"
                          size="xs"
                          title={`${userName} üyesini çıkarmak istiyor musunuz?`}
                          description="Gruptan derhal çıkarılacak ve tekrar katılmak için yeni bir davet koduna ihtiyaç duyacaktır."
                          confirmLabel="Çıkar"
                          pendingLabel="Çıkarılıyor…"
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
                  Tehlikeli Bölge
                </CardTitle>
                <CardDescription className="text-xs">
                  Bu grup için geri alınamaz işlemler.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
              <div>
                <p className="text-xs font-semibold text-foreground">Gruptan Ayrıl</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isOwner && members.length > 1
                    ? "Önce diğer tüm üyeleri çıkarmalısınız — yöneticiler başka üyeler varken gruptan ayrılamaz."
                    : "Bu gruptan ayrılacaksınız. Tekrar katılmak için bir davet koduna ihtiyacınız olacak."}
                </p>
              </div>
              <ConfirmActionButton
                triggerLabel="Gruptan Ayrıl"
                triggerVariant="outline"
                variant="destructive"
                size="sm"
                title="Bu gruptan ayrılmak istiyor musunuz?"
                description="Tekrar katılmak için geçerli bir davet koduna ihtiyacınız olacak."
                confirmLabel="Ayrıl"
                pendingLabel="Ayrılınıyor…"
                redirectTo="/groups"
                onConfirm={leaveGroup.bind(null, groupId)}
              />
            </div>

            {isOwner && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-destructive/20">
                <div>
                  <p className="text-xs font-semibold text-destructive">Grubu Sil</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Bu grubu, tüm önerilen medyaları, oyları ve üyelik kayıtlarını kalıcı olarak silin.
                  </p>
                </div>
                <ConfirmActionButton
                  triggerLabel="Grubu Sil"
                  triggerVariant="destructive"
                  variant="destructive"
                  size="sm"
                  title={`"${group.name}" grubunu silmek istiyor musunuz?`}
                  description="Bu işlem geri alınamaz. Tüm medyalar, oylar ve tartışma kayıtları kalıcı olarak silinecektir."
                  confirmLabel="Kalıcı Olarak Sil"
                  pendingLabel="Siliniyor…"
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
