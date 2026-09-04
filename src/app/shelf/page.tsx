import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ShelfView } from "./shelf-view";
import { getPersonalShelf } from "@/lib/queries/progress";
import { getUserQuotes } from "@/lib/queries/marginalia";
import { isFeatureEnabled } from "@/lib/flags/server";
import { getSession } from "@/lib/pocketbase/session";
export default async function ShelfPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isMarginaliaEnabled = await isFeatureEnabled("digital_marginalia");

  const [items, quotes] = await Promise.all([
    // H-2: pass the already-resolved page session so the actions skip their own
    // getSession() auth refresh.
    getPersonalShelf(undefined, session),
    isMarginaliaEnabled
      ? getUserQuotes(undefined, session)
      : Promise.resolve([]),
  ]);

  const currentUser = {
    id: session.id,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
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
