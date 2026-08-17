import Link from "next/link";
import { Users, Ban, Layers, Sparkles, CheckCircle2, ThumbsUp, Star, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { GroupsResponse, UsersResponse } from "@/types/pocketbase-types";

export default async function AdminDashboardPage() {
  const pb = await getSuperuserClient();

  const [
    usersCount,
    bannedCount,
    groupsCount,
    proposedCount,
    consumedCount,
    votesCount,
    reviewsCount,
    recentGroups,
  ] = await Promise.all([
    pb.collection("users").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("users")
      .getList(1, 1, { filter: 'bannedAt != ""' })
      .then((r) => r.totalItems),
    pb.collection("groups").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("titles")
      .getList(1, 1, { filter: 'status = "proposed"' })
      .then((r) => r.totalItems),
    pb
      .collection("titles")
      .getList(1, 1, { filter: 'status = "consumed"' })
      .then((r) => r.totalItems),
    pb.collection("votes").getList(1, 1).then((r) => r.totalItems),
    pb.collection("reviews").getList(1, 1).then((r) => r.totalItems),
    pb
      .collection("groups")
      .getList<GroupsResponse<{ createdBy?: UsersResponse }>>(1, 6, {
        sort: "-createdAt",
        expand: "createdBy",
      })
      .then((r) => r.items),
  ]);

  const stats = [
    { label: "Toplam Kullanıcı", value: usersCount, icon: Users, color: "text-blue-500 bg-blue-500/10" },
    { label: "Yasaklı Kullanıcı", value: bannedCount, icon: Ban, color: "text-rose-500 bg-rose-500/10" },
    { label: "Aktif Gruplar", value: groupsCount, icon: Layers, color: "text-purple-500 bg-purple-500/10" },
    { label: "Önerilen Medyalar", value: proposedCount, icon: Sparkles, color: "text-amber-500 bg-amber-500/10" },
    { label: "Tamamlanan Medyalar", value: consumedCount, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
    { label: "Toplam Oy", value: votesCount, icon: ThumbsUp, color: "text-indigo-500 bg-indigo-500/10" },
    { label: "Toplam Değerlendirme", value: reviewsCount, icon: Star, color: "text-amber-400 bg-amber-400/10" },
  ];

  return (
    <div className="space-y-8">
      <div className="pb-2 border-b">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Platform Genel Bakışı
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Sistem analitiği, etkileşim metrikleri ve yönetimsel durum.
        </p>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border/70 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {stat.label}
                  </p>
                </div>
                <div className={`flex size-10 items-center justify-center rounded-xl ${stat.color}`}>
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Recent Groups */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Son Oluşturulan Gruplar
          </h2>
          <Link
            href="/admin/groups"
            className="text-xs font-medium text-primary hover:underline"
          >
            Tüm grupları görüntüle
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recentGroups.map((group) => (
            <Link key={group.id} href={`/admin/groups/${group.id}`}>
              <Card className="border-border/70 hover:border-primary/40 transition-all p-3.5 flex items-center justify-between group shadow-2xs">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {group.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Oluşturan:{" "}
                    <span className="font-medium text-foreground">
                      {group.expand?.createdBy?.name || group.expand?.createdBy?.email || "Bilinmiyor"}
                    </span>
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
              </Card>
            </Link>
          ))}

          {recentGroups.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-lg">
              Henüz oluşturulmuş bir grup yok.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
