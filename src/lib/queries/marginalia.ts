import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireFeature } from "@/lib/flags/server";
import { logDiagnostic } from "@/lib/errors";
import { requireMembership } from "@/lib/membership";
import type {
  ShelfQuotesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";
import {
  filterQuotesForViewer,
  projectQuoteRecord,
  type QuoteExpand,
} from "@/lib/marginalia";

// Pinned interface (impl-plan-2 Cluster 2/3): when a resolved session is
// provided, skip getSession() — shelf pages pass their already-fetched session
// to avoid an authRefresh per render.
export async function getUserQuotes(
  userId?: string,
  session?: Session | null,
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  try {
    await requireFeature("digital_marginalia");
    const activeSession = session === undefined ? await getSession() : session;
    // S1: never expose quotes to anonymous callers — user ids are publicly
    // harvestable, so an unauthenticated request must get an empty list.
    if (!activeSession) return [];

    const targetUserId = userId || activeSession.id;
    if (!targetUserId) return [];

    const pb = await getSuperuserClient();
    const records = await pb
      .collection("shelf_quotes")
      .getFullList<ShelfQuotesResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("user = {:userId}", { userId: targetUserId }),
        sort: "-createdAt",
        expand: "user",
      });

    // Only the owner sees their quotes unfiltered. Every other viewer goes
    // through the mutual-circle filter — never short-circuit past it.
    if (activeSession.id === targetUserId) {
      return records.map(projectQuoteRecord);
    }

    // If viewing another user's quotes, get mutual circle memberships
    const userMemberships = await pb.collection("group_members").getFullList({
      filter: pb.filter("user = {:userId}", { userId: activeSession.id }),
    });
    const circleIds = userMemberships.map((m) => m.group);
    return filterQuotesForViewer(records, activeSession.id, circleIds).map(
      projectQuoteRecord,
    );
  } catch (err) {
    logDiagnostic(err, { action: "getUserQuotes", userId });
    return [];
  }
}

export async function getCircleQuotes(
  circleId: string,
  session?: Session | null,
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  try {
    await requireFeature("digital_marginalia");
    const activeSession = session === undefined ? await getSession() : session;
    // S5: quote sharing with a circle is only ever meant for that circle's
    // members. Anonymous callers get nothing, members are verified
    // unconditionally — never skip the membership check.
    if (!activeSession) return [];
    await requireMembership(circleId, activeSession.id);

    const pb = await getSuperuserClient();
    const records = await pb
      .collection("shelf_quotes")
      .getFullList<ShelfQuotesResponse<{ user?: UsersResponse }>>({
        // Perf M1: narrow the scan server-side (JSON array containment); the
        // strict JS-side include check below stays as the authoritative gate.
        filter: pb.filter("isSharedWithCircles ~ {:circleId}", { circleId }),
        sort: "-createdAt",
        expand: "user",
      });

    // F-3: never expand progressItem on circle-scoped reads — members would
    // otherwise receive the sharer's full private shelf record. The projected
    // author surface carries only id/name/avatarUrl.
    return records
      .filter((q) => {
        if (Array.isArray(q.isSharedWithCircles)) {
          return q.isSharedWithCircles.includes(circleId);
        }
        return false;
      })
      .map(projectQuoteRecord);
  } catch (err) {
    logDiagnostic(err, { action: "getCircleQuotes", circleId });
    return [];
  }
}
