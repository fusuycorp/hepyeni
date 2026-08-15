"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { MediaType } from "@/lib/media-types";
import { requireMembership, requireTitleInGroup } from "@/lib/membership";
import { getProvider } from "@/lib/providers";
import type { NormalizedSearchResult } from "@/lib/providers/types";

// searchTitles and addTitle are invoked imperatively from a client component
// (not via a plain <form action>), wrapped in its own try/catch to surface
// errors in the UI. redirect() throws a special error that must propagate
// un-caught to work — inside a client-caught RPC call it would just be
// swallowed as a generic failure instead of navigating. So unlike the
// form-action-based actions in this app (voteOnTitle, markConsumed,
// submitReview), these two throw plain errors instead of redirecting; the
// client is responsible for navigating on success/auth failure.

export async function searchTitles(
  mediaType: MediaType,
  query: string,
): Promise<NormalizedSearchResult[]> {
  const session = await getSession();
  if (!session) throw new Error("Please sign in again");
  if (!query.trim()) return [];

  return getProvider(mediaType).search(query.trim());
}

export async function addTitle(
  groupId: string,
  mediaType: MediaType,
  result: NormalizedSearchResult,
) {
  const session = await getSession();
  if (!session) throw new Error("Please sign in again");

  await requireMembership(groupId, session.id);

  // `result` is a plain object from the client, not re-verified against a
  // live provider search — cap sizes at this trust boundary so a member
  // can't stuff arbitrarily large strings into the DB via the action's RPC
  // endpoint (the UI would never send more than this, but the endpoint
  // itself doesn't otherwise enforce it).
  const title = result.title.slice(0, 300);
  if (!title.trim()) throw new Error("Title is required");

  const pb = await getSuperuserClient();
  try {
    // This title (by external source+id) may already be in the group — a
    // harmless no-op rather than an unhandled unique-constraint error, e.g.
    // if a client retries after a spurious failure.
    await pb.collection("titles").create({
      group: groupId,
      mediaType,
      externalSource: result.externalSource.slice(0, 100),
      externalId: result.externalId.slice(0, 200),
      title,
      creator: result.creator?.slice(0, 300),
      coverUrl: result.coverUrl?.slice(0, 2000),
      metadata: result.metadata,
      status: "proposed",
      addedBy: session.id,
    });
  } catch (err) {
    if (!isValidationNotUnique(err)) throw err;
  }
}

export async function markConsumed(titleId: string, groupId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  await requireMembership(groupId, session.id);
  await requireTitleInGroup(titleId, groupId);

  const pb = await getSuperuserClient();
  await pb.collection("titles").update(titleId, {
    status: "consumed",
    consumedAt: new Date().toISOString(),
  });

  revalidatePath(`/groups/${groupId}`);
}
