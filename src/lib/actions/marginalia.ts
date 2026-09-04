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
