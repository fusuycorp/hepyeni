"use server";

import { revalidatePath } from "next/cache";
import { getSession, type Session } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireFeature } from "@/lib/flags/server";
import { logDiagnostic } from "@/lib/errors";
import { requireMembership } from "@/lib/membership";
import type { ActionResult } from "@/types/actions";
import type {
  ShelfQuotesRecord,
  ShelfQuotesResponse,
  UsersResponse,
} from "@/types/pocketbase-types";
import {
  validateQuoteInput,
  canUserDeleteQuote,
  filterQuotesForViewer,
  projectQuoteRecord,
  type AddQuoteInput,
  type QuoteExpand,
} from "@/lib/marginalia";

export type { ActionResult };
export type {
  AddQuoteInput,
  StructuredAttribution,
  QuoteExpand,
} from "@/lib/marginalia";

export async function addQuote(
  input: AddQuoteInput,
): Promise<ActionResult<ShelfQuotesResponse<QuoteExpand>>> {
  try {
    await requireFeature("digital_marginalia");
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }

    const validation = validateQuoteInput(input);
    if (!validation.valid || !validation.sanitized) {
      return { success: false, error: validation.error || "Invalid quote data" };
    }

    const pb = await getSuperuserClient();

    let authorizedCircles: string[] = [];
    if (validation.sanitized.isSharedWithCircles && validation.sanitized.isSharedWithCircles.length > 0) {
      const memberships = await pb
        .collection("group_members")
        .getFullList({
          filter: pb.filter("user = {:userId}", { userId: session.id }),
          fields: "group",
        });
      const memberGroupIds = new Set(memberships.map((m) => m.group));
      authorizedCircles = validation.sanitized.isSharedWithCircles.filter((id) =>
        memberGroupIds.has(id),
      );
    }

    const payload: Partial<ShelfQuotesRecord> = {
      user: session.id,
      titleName: validation.sanitized.titleName,
      quoteText: validation.sanitized.quoteText,
      attribution: validation.sanitized.attribution || "",
      mediaType: validation.sanitized.mediaType || "",
      tags: validation.sanitized.tags,
      isSharedWithCircles: authorizedCircles,
    };

    if (validation.sanitized.progressItem) {
      try {
        const item = await pb
          .collection("user_media_progress")
          .getOne(validation.sanitized.progressItem, { fields: "id,user" });
        if (item.user === session.id) {
          payload.progressItem = item.id;
        }
      } catch {
        // Omit unverified or foreign progress item record safely
      }
    }

    const record = await pb
      .collection("shelf_quotes")
      .create<ShelfQuotesResponse<{ user?: UsersResponse }>>(payload, {
        expand: "user",
      });

    revalidatePath("/shelf");
    // F-3: the create response echoes only the projected author surface — no
    // email, no linked private shelf record.
    return { success: true, data: projectQuoteRecord(record) };
  } catch (err) {
    // S2: never log the raw user input payload (quote text is private).
    const diag = logDiagnostic(err, { action: "addQuote" });
    return {
      success: false,
      error: "Failed to add quote",
      traceId: diag.traceId,
    };
  }
}

export async function deleteQuote(quoteId: string): Promise<ActionResult<void>> {
  try {
    await requireFeature("digital_marginalia");
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }

    const pb = await getSuperuserClient();
    const quote = await pb.collection("shelf_quotes").getOne<ShelfQuotesResponse>(quoteId);
    if (!quote) {
      return { success: false, error: "Quote not found" };
    }

    if (!canUserDeleteQuote(quote, session)) {
      return { success: false, error: "Unauthorized to delete this quote" };
    }

    await pb.collection("shelf_quotes").delete(quoteId);
    revalidatePath("/shelf");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "deleteQuote", quoteId });
    return {
      success: false,
      error: "Failed to delete quote",
      traceId: diag.traceId,
    };
  }
}

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
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  try {
    await requireFeature("digital_marginalia");
    const session = await getSession();
    // S5: quote sharing with a circle is only ever meant for that circle's
    // members. Anonymous callers get nothing, members are verified
    // unconditionally — never skip the membership check.
    if (!session) return [];
    await requireMembership(circleId, session.id);

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

export async function toggleShareQuoteWithCircle(
  quoteId: string,
  circleId: string,
): Promise<ActionResult<{ isShared: boolean }>> {
  try {
    await requireFeature("digital_marginalia");
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }

    const pb = await getSuperuserClient();
    const quote = await pb.collection("shelf_quotes").getOne<ShelfQuotesResponse>(quoteId);
    if (!quote) {
      return { success: false, error: "Quote not found" };
    }

    if (!canUserDeleteQuote(quote, session)) {
      return { success: false, error: "Unauthorized to update this quote" };
    }

    await requireMembership(circleId, session.id);

    const currentCircles = Array.isArray(quote.isSharedWithCircles)
      ? [...quote.isSharedWithCircles]
      : [];

    let isShared = false;
    let updatedCircles: string[] = [];

    if (currentCircles.includes(circleId)) {
      updatedCircles = currentCircles.filter((id) => id !== circleId);
      isShared = false;
    } else {
      updatedCircles = [...currentCircles, circleId];
      isShared = true;
    }

    await pb.collection("shelf_quotes").update(quoteId, {
      isSharedWithCircles: updatedCircles,
    });

    revalidatePath("/shelf");
    return { success: true, data: { isShared } };
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "toggleShareQuoteWithCircle",
      quoteId,
      circleId,
    });
    return {
      success: false,
      error: "Failed to toggle circle share",
      traceId: diag.traceId,
    };
  }
}
