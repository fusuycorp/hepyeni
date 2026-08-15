"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";
import { voteRecordId } from "@/lib/pocketbase/vote-id";
import type { VotesResponse } from "@/types/pocketbase-types";

export async function voteOnTitle(
  titleId: string,
  groupId: string,
  value: "up" | "down",
) {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

  const pb = await getSuperuserClient();
  const id = await voteRecordId(titleId, session.id);

  // The vote record's own id is a deterministic hash of (titleId, userId) —
  // see vote-id.ts. The first create() for that pair is atomic by
  // construction (SQLite's single-writer model serializes concurrent
  // creates; exactly one wins, the other 400s). Empirically, PocketBase's
  // app-level validation catches the (title, user) composite unique index
  // before the id collision, so the error lands on those fields, not "id" —
  // confirmed against a real instance, don't scope the field check. On a
  // 400 there's already an existing vote: same value clicked again ->
  // delete (toggle off), different value -> flip. This narrower flip/delete
  // decision still reads then writes, so two near-simultaneous toggles on
  // an already-existing vote can last-write-wins on the value — accepted as
  // a low-stakes residual race (never a duplicate row, never a 500).
  try {
    await pb
      .collection("votes")
      .create<VotesResponse>({ id, title: titleId, user: session.id, value });
  } catch (err) {
    if (!isValidationNotUnique(err)) throw err;

    const existing = await pb.collection("votes").getOne<VotesResponse>(id);
    if (existing.value === value) {
      await pb.collection("votes").delete(id);
    } else {
      await pb.collection("votes").update(id, { value });
    }
  }

  revalidatePath(`/groups/${groupId}`);
}
