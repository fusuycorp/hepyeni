"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { votes } from "@/db/schema";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";

export async function voteOnTitle(
  titleId: string,
  groupId: string,
  value: "up" | "down",
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireMembership(groupId, session.user.id);
  await requireTitleInGroup(titleId, groupId);

  const userId = session.user.id;

  // The toggle decision (insert / switch / delete) depends on reading
  // current state first — an upsert alone prevents the unique-constraint
  // crash on concurrent inserts, but two overlapping requests can still
  // race on the read: request A inserts "up", then request B reads that
  // row and (wrongly, from B's own intent) deletes it as a "toggle off".
  // An advisory lock scoped to this exact (titleId, userId) pair
  // serializes concurrent toggles for the same vote without blocking
  // unrelated votes (different title, different user, or different title+
  // user pairs all proceed independently).
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${titleId} || ${userId}, 0))`,
    );

    const existing = await tx.query.votes.findFirst({
      where: and(eq(votes.titleId, titleId), eq(votes.userId, userId)),
    });

    if (existing?.value === value) {
      await tx.delete(votes).where(eq(votes.id, existing.id));
    } else if (existing) {
      await tx.update(votes).set({ value }).where(eq(votes.id, existing.id));
    } else {
      await tx.insert(votes).values({ titleId, userId, value });
    }
  });

  revalidatePath(`/groups/${groupId}`);
}
