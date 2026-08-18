import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ShelfView } from "./shelf-view";
import { getPersonalShelf } from "@/lib/actions/progress";
import { getUserQuotes } from "@/lib/actions/marginalia";
import { isFeatureEnabled } from "@/lib/flags/server";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getServerTranslations } from "@/lib/i18n/server";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function ShelfPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isMarginaliaEnabled = await isFeatureEnabled("digital_marginalia");

  const [t, items, quotes, pb] = await Promise.all([
    getServerTranslations(),
    getPersonalShelf(),
    isMarginaliaEnabled ? getUserQuotes(session.id) : Promise.resolve([]),
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
      <ShelfView
        initialItems={items}
        initialQuotes={quotes}
        currentUserId={session.id}
        isAdmin={session.isAdmin}
      />
    </AppShell>
  );
}
