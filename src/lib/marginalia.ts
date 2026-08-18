import type {
  UsersResponse,
  UserMediaProgressResponse,
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

export type QuoteExpand = {
  user?: UsersResponse;
  progressItem?: UserMediaProgressResponse;
};

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
  if (typeof options !== "object") {
    return "";
  }

  const parts: string[] = [];
  if (typeof options.author === "string" && options.author.trim()) parts.push(options.author.trim());
  if (typeof options.work === "string" && options.work.trim()) parts.push(options.work.trim());
  if (typeof options.chapter === "string" && options.chapter.trim()) parts.push(options.chapter.trim());

  let base = parts.join(", ");

  if (options.page !== undefined && options.page !== null) {
    try {
      const pageStr = String(options.page).trim();
      if (pageStr) {
        const formattedPage =
          pageStr.startsWith("p.") || pageStr.startsWith("s.") || pageStr.startsWith("page")
            ? pageStr
            : `p. ${pageStr}`;
        base = base ? `${base} (${formattedPage})` : `(${formattedPage})`;
      }
    } catch {
      // Ignore conversion failures on corrupt objects
    }
  }

  if (typeof options.timestamp === "string") {
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
  if (!input || typeof input !== "object") return { valid: false, error: "Invalid input" };

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
  quote: { user?: string; isSharedWithCircles?: string[] | null },
  viewerUserId?: string,
  memberCircleIds: string[] = [],
): boolean {
  if (!viewerUserId || typeof viewerUserId !== "string" || !quote || typeof quote !== "object") {
    return false;
  }
  if (quote.user === viewerUserId) return true;
  if (
    !quote.isSharedWithCircles ||
    !Array.isArray(quote.isSharedWithCircles) ||
    quote.isSharedWithCircles.length === 0
  ) {
    return false;
  }
  if (!Array.isArray(memberCircleIds) || memberCircleIds.length === 0) {
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
