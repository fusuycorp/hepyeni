import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";

export const MAX_INPUT_CHARS = 60_000;
export const MAX_CANDIDATES = 25;
export const MAX_TITLE_CHARS = 300;
export const MAX_CREATOR_CHARS = 300;
export const MAX_REASON_CHARS = 500;

export interface ExtractedCandidate {
  title: string;
  creator?: string;
  mediaType: MediaType;
  reason?: string;
  rating?: number; // 1-5 integer
}

export type DumpValidation =
  | { ok: true; clean: string }
  | { ok: false; reason: "empty" | "too_large" };

export function validateRawDump(text: string): DumpValidation {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, reason: "empty" };
  }
  const clean = text.trim();
  if (clean.length > MAX_INPUT_CHARS) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true, clean };
}

function stripControlChars(value: string): string {
  // Remove ASCII control chars but keep \t/\n (multi-line reasons survive) —
  // \u0000-\u0008, \u000B-\u001F, \u007F are the lurking injection/formatting bytes.
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

function cleanTitle(value: string): string {
  return stripControlChars(value).replace(/\s+/gu, " ").trim();
}

function cleanFreeText(value: string, cap: number): string {
  return stripControlChars(value).trim().slice(0, cap);
}

// Fold case + diacritics + punctuation ("Duné" -> "dune") so near-duplicate
// spellings the LLM emits collapse to one candidate. Mirrors the importers'
// normalizeTitleKey intent but hardens it against accent drift.
export function foldTitleKey(mediaType: string, title: string): string {
  const folded = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  return `${mediaType}:${folded}`;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function stepBracketStringChar(
  ch: string,
  escaped: boolean,
): { inString: boolean; escaped: boolean } {
  if (escaped) return { inString: true, escaped: false };
  if (ch === "\\") return { inString: true, escaped: true };
  return { inString: ch !== '"', escaped: false };
}

function findBalancedJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      const next = stepBracketStringChar(ch, escaped);
      inString = next.inString;
      escaped = next.escaped;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isPreferredJsonBlock(value: unknown): boolean {
  if (!Array.isArray(value)) return true;
  if (value.length === 0) return true;
  return value.some((el) => el !== null && typeof el === "object" && !Array.isArray(el));
}

function isJsonObjectOrArray(val: unknown): val is object {
  return val !== undefined && val !== null && typeof val === "object";
}

function scanBalancedJsonBlocks(trimmed: string): unknown {
  let searchFrom = 0;
  let fallback: unknown = null;

  while (searchFrom < trimmed.length) {
    const relStart = trimmed.slice(searchFrom).search(/[\[{]/);
    if (relStart === -1) break;
    const start = searchFrom + relStart;
    const closedAt = findBalancedJsonEnd(trimmed, start);
    if (closedAt === -1) break;

    const value = safeJsonParse(trimmed.slice(start, closedAt + 1));
    if (isJsonObjectOrArray(value)) {
      if (isPreferredJsonBlock(value)) return value;
      if (fallback === null) fallback = value;
    }

    searchFrom = closedAt + 1;
  }

  return fallback;
}

export function extractJsonValue(content: string): unknown {
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }
  const trimmed = content.trim();

  const direct = safeJsonParse(trimmed);
  if (direct !== undefined) {
    return isJsonObjectOrArray(direct) ? direct : null;
  }

  // The model sometimes wraps JSON in prose / markdown fences. Scan for
  // balanced [ or { blocks (string-aware so "brackets inside quotes"
  // don't disturb the balance); if a leading bracketed citation like "[1]"
  // parses to a primitive array, continue scanning for the real JSON block.
  return scanBalancedJsonBlocks(trimmed);
}

function arrayFromValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") {
    for (const key of ["titles", "items", "results"]) {
      const list = (value as Record<string, unknown>)[key];
      if (Array.isArray(list)) return list;
    }
  }
  return [];
}

function cleanOptionalText(val: unknown, cap: number): string | undefined {
  if (typeof val !== "string") return undefined;
  const cleaned = cleanFreeText(val, cap);
  return cleaned || undefined;
}

function parseIntegerRating(val: unknown): number | undefined {
  return typeof val === "number" && Number.isInteger(val) && val >= 1 && val <= 5
    ? val
    : undefined;
}

function validateCandidate(item: unknown): ExtractedCandidate | null {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;

  const title =
    typeof record.title === "string"
      ? cleanTitle(record.title).slice(0, MAX_TITLE_CHARS)
      : "";
  const mediaType = record.mediaType;
  if (!title || typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType as MediaType)) {
    return null;
  }

  return {
    title,
    mediaType: mediaType as MediaType,
    creator: cleanOptionalText(record.creator, MAX_CREATOR_CHARS),
    reason: cleanOptionalText(record.reason, MAX_REASON_CHARS),
    rating: parseIntegerRating(record.rating),
  };
}

export function parseAndValidateLlmOutput(
  content: string,
): { candidates: ExtractedCandidate[]; dropped: number } {
  const value = extractJsonValue(content);
  const items = arrayFromValue(value);

  const candidates: ExtractedCandidate[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const item of items) {
    const candidate = validateCandidate(item);
    if (!candidate) {
      dropped++;
      continue;
    }
    const dedupeKey = foldTitleKey(candidate.mediaType, candidate.title);
    if (seen.has(dedupeKey)) {
      dropped++;
      continue;
    }
    if (candidates.length >= MAX_CANDIDATES) {
      dropped++;
      continue;
    }
    seen.add(dedupeKey);
    candidates.push(candidate);
  }

  return { candidates, dropped };
}