import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ImportExportView } from "./import-export-view";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function ImportExportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();

  const userRecord = await pb
    .collection("users")
    .getOne<UsersResponse>(session.id)
    .catch(() => null);

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell user={currentUser} maxWidth="wide">
      <ImportExportView />
    </AppShell>
  );
}
