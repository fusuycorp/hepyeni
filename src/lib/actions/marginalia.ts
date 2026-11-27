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
  UsersResponse,
} from "@/types/pocketbase-types";
import {
  validateQuoteInput,
  canUserDeleteQuote,
  projectQuoteRecord,
  type AddQuoteInput,
  type QuoteExpand,
} from "@/lib/marginalia";
import {
  getUserQuotes as getUserQuotesQuery,
  getCircleQuotes as getCircleQuotesQuery,
} from "@/lib/queries/marginalia";

export type { ActionResult };
export type {
  AddQuoteInput,
  StructuredAttribution,
  QuoteExpand,
} from "@/lib/marginalia";

async function resolveAuthorizedQuoteCircles(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  userId: string,
  requestedCircles?: string[],
): Promise<string[]> {
  if (!requestedCircles || requestedCircles.length === 0) return [];
  const memberships = await pb.collection("group_members").getFullList({
    filter: pb.filter("user = {:userId}", { userId }),
    fields: "group",
  });
  const memberGroupIds = new Set(memberships.map((m) => m.group));
  return requestedCircles.filter((id) => memberGroupIds.has(id));
}

async function resolveVerifiedProgressItemId(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  userId: string,
  progressItemId?: string,
): Promise<string | undefined> {
  if (!progressItemId) return undefined;
  try {
    const item = await pb
      .collection("user_media_progress")
      .getOne(progressItemId, { fields: "id,user" });
    return item.user === userId ? item.id : undefined;
  } catch {
    return undefined;
  }
}

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
    const { sanitized } = validation;
    const [authorizedCircles, verifiedProgressId] = await Promise.all([
      resolveAuthorizedQuoteCircles(pb, session.id, sanitized.isSharedWithCircles),
      resolveVerifiedProgressItemId(pb, session.id, sanitized.progressItem),
    ]);

    const payload: Partial<ShelfQuotesRecord> = {
      user: session.id,
      titleName: sanitized.titleName,
      quoteText: sanitized.quoteText,
      attribution: sanitized.attribution || "",
      mediaType: sanitized.mediaType || "",
      tags: sanitized.tags,
      isSharedWithCircles: authorizedCircles,
      ...(verifiedProgressId ? { progressItem: verifiedProgressId } : {}),
    };

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

export async function getUserQuotes(
  userId?: string,
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  const session = await getSession();
  return getUserQuotesQuery(userId, session);
}

export async function getCircleQuotes(
  circleId: string,
): Promise<ShelfQuotesResponse<QuoteExpand>[]> {
  const session = await getSession();
  return getCircleQuotesQuery(circleId, session);
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

    const currentCircles = Array.isArray(quote.isSharedWithCircles)
      ? [...quote.isSharedWithCircles]
      : [];
    const isCurrentlyShared = currentCircles.includes(circleId);

    if (!isCurrentlyShared) {
      await requireMembership(circleId, session.id);
    }

    let isShared = false;
    let updatedCircles: string[] = [];

    if (isCurrentlyShared) {
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
