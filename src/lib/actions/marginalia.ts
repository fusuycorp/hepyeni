"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { requireFeature } from "@/lib/flags/server";
import { logDiagnostic } from "@/lib/errors";
import { requireMembership } from "@/lib/membership";
import type { ActionResult } from "@/types/actions";
import type {
  ShelfQuotesRecord,
  ShelfQuotesResponse,
} from "@/types/pocketbase-types";
import {
  parseTags,
  validateQuoteInput,
  canUserDeleteQuote,
  filterQuotesForViewer,
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
    const payload: Partial<ShelfQuotesRecord> = {
      user: session.id,
      titleName: validation.sanitized.titleName,
      quoteText: validation.sanitized.quoteText,
      attribution: validation.sanitized.attribution || "",
      mediaType: validation.sanitized.mediaType || "",
      tags: validation.sanitized.tags,
      isSharedWithCircles: validation.sanitized.isSharedWithCircles,
    };

    if (validation.sanitized.progressItem) {
      payload.progressItem = validation.sanitized.progressItem;
    }

    const record = await pb
      .collection("shelf_quotes")
      .create<ShelfQuotesResponse<QuoteExpand>>(payload, {
        expand: "user,progressItem",
      });

    revalidatePath("/shelf");
    return { success: true, data: record };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "addQuote", input });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add quote",
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
      error: err instanceof Error ? err.message : "Failed to delete quote",
      traceId: diag.traceId,
    };
  }
}

export async function getUserQuotes(
  userId?: string,
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  try {
    await requireFeature("digital_marginalia");
    const session = await getSession();
    const targetUserId = userId || session?.id;
    if (!targetUserId) return [];

    const pb = await getSuperuserClient();
    const records = await pb.collection("shelf_quotes").getFullList<ShelfQuotesResponse<QuoteExpand>>({
      filter: `user = "${targetUserId}"`,
      sort: "-createdAt",
      expand: "user,progressItem",
    });

    if (!session || session.id === targetUserId) {
      return records;
    }

    // If viewing another user's quotes, get mutual circle memberships
    const userMemberships = await pb.collection("group_members").getFullList({
      filter: `user = "${session.id}"`,
    });
    const circleIds = userMemberships.map((m) => m.group);
    return filterQuotesForViewer(records, session.id, circleIds);
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
    if (session) {
      await requireMembership(circleId, session.id);
    }

    const pb = await getSuperuserClient();
    const records = await pb.collection("shelf_quotes").getFullList<ShelfQuotesResponse<QuoteExpand>>({
      sort: "-createdAt",
      expand: "user,progressItem",
    });

    return records.filter((q) => {
      if (Array.isArray(q.isSharedWithCircles)) {
        return q.isSharedWithCircles.includes(circleId);
      }
      return false;
    });
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
      error: err instanceof Error ? err.message : "Failed to toggle circle share",
      traceId: diag.traceId,
    };
  }
}
