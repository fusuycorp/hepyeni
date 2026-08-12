import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { AddTitleForm } from "./add-title-form";

export default async function AddTitlePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { groupId } = await params;

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, session.user.id),
    ),
  });
  if (!membership) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-zinc-500">
          &larr; Back
        </Link>
        <h1 className="text-lg font-semibold">Add a title</h1>
      </header>
      <AddTitleForm groupId={groupId} />
    </div>
  );
}
