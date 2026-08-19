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

export function extractJsonValue(content: string): unknown {
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }
  const trimmed = content.trim();

  const safeParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const direct = safeParse(trimmed);
  if (direct !== undefined) {
    if (Array.isArray(direct)) return direct;
    if (direct !== null && typeof direct === "object") return direct;
    return null;
  }

  // The model sometimes wraps JSON in prose / markdown fences. Scan for the
  // first balanced [ or { block (string-aware so "brackets inside quotes"
  // don't disturb the balance) and parse just that span.
  const start = trimmed.search(/[\[{]/);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
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
      if (depth === 0) {
        const block = trimmed.slice(start, i + 1);
        const value = safeParse(block);
        if (value === undefined || value === null || typeof value !== "object") return null;
        return value;
      }
    }
  }
  return null;
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

function validateCandidate(item: unknown): ExtractedCandidate | null {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;

  const title =
    typeof record.title === "string"
      ? cleanTitle(record.title).slice(0, MAX_TITLE_CHARS)
      : "";
  if (!title) return null;

  const mediaType = record.mediaType;
  if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType as MediaType)) {
    return null;
  }

  const creator =
    typeof record.creator === "string" && record.creator.trim()
      ? cleanFreeText(record.creator, MAX_CREATOR_CHARS)
      : undefined;

  const reason =
    typeof record.reason === "string" && record.reason.trim()
      ? cleanFreeText(record.reason, MAX_REASON_CHARS)
      : undefined;

  let rating: number | undefined;
  if (
    typeof record.rating === "number" &&
    Number.isInteger(record.rating) &&
    record.rating >= 1 &&
    record.rating <= 5
  ) {
    rating = record.rating;
  }

  return { title, mediaType: mediaType as MediaType, creator, reason, rating };
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