import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { LandingView } from "./landing-view";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function Home() {
  const session = await getSession();
  let userRecord: UsersResponse | null = null;

  if (session) {
    try {
      const pb = await getSuperuserClient();
      userRecord = await pb.collection("users").getOne<UsersResponse>(session.id);
    } catch {
      // Non-blocking fallback
      userRecord = null;
    }
  }

  const currentUser = session
    ? {
        id: session.id,
        email: session.email,
        name: userRecord?.name,
        avatarUrl: userRecord?.avatarUrl,
      }
    : null;

  return <LandingView currentUser={currentUser} />;
}
