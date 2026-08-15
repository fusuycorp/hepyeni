import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getSession } from "@/lib/pocketbase/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireAdmin(session.id);

  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/admin" className="font-medium">
            Admin
          </Link>
          <Link href="/admin/users" className="text-zinc-500">
            Users
          </Link>
          <Link href="/admin/groups" className="text-zinc-500">
            Groups
          </Link>
          <Link href="/groups" className="ml-auto text-zinc-500 underline">
            Back to app
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
