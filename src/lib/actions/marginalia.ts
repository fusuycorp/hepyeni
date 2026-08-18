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
  UserMediaProgressResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export type { ActionResult };

export interface AddQuoteInput {
  quoteText: string;
  titleName: string;
  attribution?: string;
  mediaType?: string;
  progressItem?: string;
  tags?: string[] | string;
  isSharedWithCircles?: string[] | boolean;
}

export interface StructuredAttribution {
  author?: string;
  work?: string;
  chapter?: string;
  page?: string | number;
  timestamp?: string;
}

export function parseTags(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  let rawList: string[] = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === "string") {
    if (input.includes(",")) {
      rawList = input.split(",");
    } else {
      rawList = input.split(/\s+/);
    }
  }

  const tagSet = new Set<string>();
  const result: string[] = [];

  for (let tag of rawList) {
    if (typeof tag !== "string") continue;
    tag = tag.trim();
    if (tag.startsWith("#")) {
      tag = tag.slice(1).trim();
    }
    if (!tag) continue;
    if (tag.length > 50) {
      tag = tag.slice(0, 50);
    }
    const lower = tag.toLowerCase();
    if (!tagSet.has(lower)) {
      tagSet.add(lower);
      result.push(lower);
    }
  }

  return result;
}

export function formatAttribution(
  options?: StructuredAttribution | string | null,
): string {
  if (!options) return "";
  if (typeof options === "string") {
    return options.trim();
  }

  const parts: string[] = [];
  if (options.author && options.author.trim()) parts.push(options.author.trim());
  if (options.work && options.work.trim()) parts.push(options.work.trim());
  if (options.chapter && options.chapter.trim()) parts.push(options.chapter.trim());

  let base = parts.join(", ");

  if (options.page) {
    const pageStr = String(options.page).trim();
    if (pageStr) {
      const formattedPage =
        pageStr.startsWith("p.") || pageStr.startsWith("s.") || pageStr.startsWith("page")
          ? pageStr
          : `p. ${pageStr}`;
      base = base ? `${base} (${formattedPage})` : `(${formattedPage})`;
    }
  }

  if (options.timestamp) {
    const tsStr = options.timestamp.trim();
    if (tsStr) {
      base = base ? `${base} [${tsStr}]` : `[${tsStr}]`;
    }
  }

  return base;
}

export function validateQuoteInput(input: AddQuoteInput): {
  valid: boolean;
  error?: string;
  sanitized?: {
    quoteText: string;
    titleName: string;
    attribution?: string;
    mediaType?: string;
    progressItem?: string;
    tags: string[];
    isSharedWithCircles: string[];
  };
} {
  if (!input) return { valid: false, error: "Invalid input" };

  const rawQuote = typeof input.quoteText === "string" ? input.quoteText.trim() : "";
  if (!rawQuote || rawQuote.length === 0) {
    return { valid: false, error: "Quote text is required (1-3000 chars)" };
  }
  if (rawQuote.length > 3000) {
    return { valid: false, error: "Quote text cannot exceed 3000 characters" };
  }

  const rawTitle = typeof input.titleName === "string" ? input.titleName.trim() : "";
  if (!rawTitle || rawTitle.length === 0) {
    return { valid: false, error: "Title name is required (1-200 chars)" };
  }
  if (rawTitle.length > 200) {
    return { valid: false, error: "Title name cannot exceed 200 characters" };
  }

  const rawAttr = typeof input.attribution === "string" ? input.attribution.trim() : undefined;
  if (rawAttr && rawAttr.length > 200) {
    return { valid: false, error: "Attribution cannot exceed 200 characters" };
  }

  const tags = parseTags(input.tags);
  let isSharedWithCircles: string[] = [];
  if (Array.isArray(input.isSharedWithCircles)) {
    isSharedWithCircles = input.isSharedWithCircles.filter(
      (c) => typeof c === "string" && c.trim().length > 0,
    );
  } else if (input.isSharedWithCircles === true) {
    isSharedWithCircles = [];
  }

  return {
    valid: true,
    sanitized: {
      quoteText: rawQuote,
      titleName: rawTitle,
      attribution: rawAttr || undefined,
      mediaType:
        typeof input.mediaType === "string" && input.mediaType.trim()
          ? input.mediaType.trim()
          : undefined,
      progressItem:
        typeof input.progressItem === "string" && input.progressItem.trim()
          ? input.progressItem.trim()
          : undefined,
      tags,
      isSharedWithCircles,
    },
  };
}

export function canUserViewQuote(
  quote: { user: string; isSharedWithCircles?: string[] | null },
  viewerUserId: string,
  memberCircleIds: string[] = [],
): boolean {
  if (!viewerUserId) return false;
  if (quote.user === viewerUserId) return true;
  if (
    !quote.isSharedWithCircles ||
    !Array.isArray(quote.isSharedWithCircles) ||
    quote.isSharedWithCircles.length === 0
  ) {
    return false;
  }
  return quote.isSharedWithCircles.some((cId) => memberCircleIds.includes(cId));
}

export function canUserDeleteQuote(
  quote: { user: string },
  session: { id: string; isAdmin?: boolean } | null | undefined,
): boolean {
  if (!session || !session.id) return false;
  if (session.isAdmin) return true;
  return quote.user === session.id;
}

export function filterQuotesForViewer<
  T extends { id: string; user: string; isSharedWithCircles?: string[] | null },
>(quotes: T[], viewerUserId: string, memberCircleIds: string[] = []): T[] {
  return quotes.filter((q) => canUserViewQuote(q, viewerUserId, memberCircleIds));
}

export type QuoteExpand = {
  user?: UsersResponse;
  progressItem?: UserMediaProgressResponse;
};

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
      await requireMembership(session.id, circleId);
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

    await requireMembership(session.id, circleId);

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
