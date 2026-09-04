import { getSession } from "@/lib/pocketbase/session";
import { LandingView } from "./landing-view";

export default async function Home() {
  const session = await getSession();

  const currentUser = session
    ? {
        id: session.id,
        email: session.email,
        name: session.name,
        avatarUrl: session.avatarUrl,
      }
    : null;

  return <LandingView currentUser={currentUser} />;
}
