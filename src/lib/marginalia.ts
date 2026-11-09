import type {
  UsersResponse,
  ShelfQuotesResponse,
} from "@/types/pocketbase-types";

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

// The only author identity fields quote responses may carry: id, display name
// and avatar. The full UsersResponse (email, emailVisibility, verified, dates)
// must never leave the action boundary.
export interface QuoteUser {
  id: string;
  name?: string;
  avatarUrl?: string;
}

export type QuoteExpand = {
  user?: QuoteUser;
};

export function projectQuoteUser(
  user: UsersResponse | undefined | null,
): QuoteUser | undefined {
  if (!user || typeof user !== "object") return undefined;
  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
}

// F-3/M1: quote reads never ship the linked private shelf record or the
// author's email. PocketBase is read with the superuser client (null API
// rules), so the expand carries the full user_media_progress/UsersResponse —
// project it down to the visible surface here, at the response boundary.
export function projectQuoteRecord(
  quote: ShelfQuotesResponse<{ user?: UsersResponse }>,
): ShelfQuotesResponse<QuoteExpand> {
  const { expand, ...rest } = quote;
  return {
    ...rest,
    expand: { user: projectQuoteUser(expand?.user) },
  };
}

function splitRawTags(input: string | string[]): string[] {
  if (Array.isArray(input)) return input;
  if (typeof input !== "string") return [];
  return input.includes(",") ? input.split(",") : input.split(/\s+/);
}

function normalizeSingleTag(rawTag: unknown): string | null {
  if (typeof rawTag !== "string") return null;
  let tag = rawTag.trim();
  if (tag.startsWith("#")) tag = tag.slice(1).trim();
  if (!tag) return null;
  return tag.slice(0, 50).toLowerCase();
}

export function parseTags(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const tagSet = new Set<string>();
  const result: string[] = [];

  for (const rawTag of splitRawTags(input)) {
    const lower = normalizeSingleTag(rawTag);
    if (lower && !tagSet.has(lower)) {
      tagSet.add(lower);
      result.push(lower);
    }
  }

  return result.slice(0, 20);
}

function formatPageNumber(page: unknown): string | null {
  if (page === undefined || page === null) return null;
  try {
    const pageStr = String(page).trim();
    if (!pageStr) return null;
    return /^(p\.|s\.|page)/i.test(pageStr) ? pageStr : `p. ${pageStr}`;
  } catch {
    return null;
  }
}

export function formatAttribution(
  options?: StructuredAttribution | string | null,
): string {
  if (!options) return "";
  if (typeof options === "string") return options.trim();
  if (typeof options !== "object") return "";

  const parts = [options.author, options.work, options.chapter]
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .map((v) => v.trim());

  let base = parts.join(", ");
  const formattedPage = formatPageNumber(options.page);
  if (formattedPage) {
    base = base ? `${base} (${formattedPage})` : `(${formattedPage})`;
  }

  const tsStr = typeof options.timestamp === "string" ? options.timestamp.trim() : "";
  if (tsStr) {
    base = base ? `${base} [${tsStr}]` : `[${tsStr}]`;
  }

  return base;
}

function trimOptionalString(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed || undefined;
}

function sanitizeSharedCircles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

function validateRequiredTextLength(
  val: unknown,
  max: number,
  emptyMsg: string,
  maxMsg: string,
): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof val === "string" ? val.trim() : "";
  if (!text) return { ok: false, error: emptyMsg };
  if (text.length > max) return { ok: false, error: maxMsg };
  return { ok: true, text };
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
  if (!input || typeof input !== "object") return { valid: false, error: "Invalid input" };

  const quoteCheck = validateRequiredTextLength(
    input.quoteText,
    3000,
    "Quote text is required (1-3000 chars)",
    "Quote text cannot exceed 3000 characters",
  );
  if (!quoteCheck.ok) return { valid: false, error: quoteCheck.error };

  const titleCheck = validateRequiredTextLength(
    input.titleName,
    200,
    "Title name is required (1-200 chars)",
    "Title name cannot exceed 200 characters",
  );
  if (!titleCheck.ok) return { valid: false, error: titleCheck.error };

  const rawAttr = trimOptionalString(input.attribution);
  if (rawAttr && rawAttr.length > 200) {
    return { valid: false, error: "Attribution cannot exceed 200 characters" };
  }

  return {
    valid: true,
    sanitized: {
      quoteText: quoteCheck.text,
      titleName: titleCheck.text,
      attribution: rawAttr,
      mediaType: trimOptionalString(input.mediaType),
      progressItem: trimOptionalString(input.progressItem),
      tags: parseTags(input.tags),
      isSharedWithCircles: sanitizeSharedCircles(input.isSharedWithCircles),
    },
  };
}

export function canUserViewQuote(
  quote: { user?: string; isSharedWithCircles?: string[] | null },
  viewerUserId?: string,
  memberCircleIds: string[] = [],
): boolean {
  if (!viewerUserId || typeof viewerUserId !== "string" || !quote || typeof quote !== "object") {
    return false;
  }
  if (quote.user === viewerUserId) return true;
  if (!Array.isArray(quote.isSharedWithCircles) || !Array.isArray(memberCircleIds)) {
    return false;
  }
  return quote.isSharedWithCircles.some(
    (cId) => typeof cId === "string" && memberCircleIds.includes(cId),
  );
}

export function canUserDeleteQuote(
  quote: { user?: string },
  session: { id: string; isAdmin?: boolean } | null | undefined,
): boolean {
  if (!quote || typeof quote !== "object" || !session || !session.id || typeof session.id !== "string") {
    return false;
  }
  if (session.isAdmin === true) return true;
  return quote.user === session.id;
}

export function filterQuotesForViewer<
  T extends { id: string; user: string; isSharedWithCircles?: string[] | null },
>(quotes: T[], viewerUserId: string, memberCircleIds: string[] = []): T[] {
  if (!quotes || !Array.isArray(quotes)) return [];
  return quotes.filter((q) => q && canUserViewQuote(q, viewerUserId, memberCircleIds));
}
