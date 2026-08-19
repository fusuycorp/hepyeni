import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AddTitleForm } from "./add-title-form";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getServerTranslations } from "@/lib/i18n/server";
import type { GroupsResponse, UsersResponse } from "@/types/pocketbase-types";

export default async function AddTitlePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = await getServerTranslations();

  const { groupId } = await params;
  const pb = await getSuperuserClient();

  let group: GroupsResponse;
  try {
    await pb
      .collection("group_members")
      .getFirstListItem(
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

  const userRecord = await pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null);

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
      maxWidth="wide"
      backHref={`/groups/${groupId}`}
      backLabel={group.name}
      title={`${t.groups.proposeMedia} · ${group.name}`}
    >
      <div className="flex flex-col gap-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.groups.proposeMedia}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t.titles.addToGroupDesc.replace("{group}", group.name)}
          </p>
        </div>

        <AddTitleForm groupId={groupId} />
      </div>
    </AppShell>
  );
}
