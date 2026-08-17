import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ShelfView } from "./shelf-view";
import { getPersonalShelf } from "@/lib/actions/progress";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function ShelfPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [t, items, pb] = await Promise.all([
    getServerTranslations(),
    getPersonalShelf(),
    getSuperuserClient(),
  ]);

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
      <ShelfView initialItems={items} />
    </AppShell>
  );
}
