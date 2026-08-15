import { redirect } from "next/navigation";
import { getSession } from "@/lib/pocketbase/session";

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/groups" : "/login");
}
