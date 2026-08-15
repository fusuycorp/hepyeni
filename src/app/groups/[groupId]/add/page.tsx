import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { isNotFound } from "@/lib/pocketbase/errors";
import { AddTitleForm } from "./add-title-form";

export default async function AddTitlePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { groupId } = await params;
  const pb = await getSuperuserClient();

  try {
    await pb
      .collection("group_members")
      .getFirstListItem(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId: session.id,
        }),
      );
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Button
          render={<Link href={`/groups/${groupId}`} />}
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground"
        >
          &larr; Back
        </Button>
        <h1 className="text-lg font-semibold">Add a title</h1>
      </header>
      <AddTitleForm groupId={groupId} />
    </div>
  );
}
