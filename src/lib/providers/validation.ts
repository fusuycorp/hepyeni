import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import type { NormalizedSearchResult } from "./types";

const MAX_SOURCE_CHARS = 100;
const MAX_EXTERNAL_ID_CHARS = 200;
const MAX_TITLE_CHARS = 300;
const MAX_CREATOR_CHARS = 300;
const MAX_COVER_URL_CHARS = 2000;

function foldTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const BLOCKED_EXACT_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "::",
  "::1",
  "0:0:0:0:0:0:0:1",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];

const BLOCKED_HOST_PREFIXES = [
  "::ffff:",
  "0:0:0:0:0:ffff:",
  "127.",
  "169.254.",
  "10.",
  "192.168.",
];

const BLOCKED_HOST_PATTERNS = [
  /^fe[89ab][0-9a-f]:/,
  /^f[cd][0-9a-f]{2}:/,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isBlockedCoverHostname(host: string): boolean {
  if (BLOCKED_EXACT_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (BLOCKED_HOST_PREFIXES.some((p) => host.startsWith(p))) return true;
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(host));
}

export function isSafeCoverUrl(rawUrl: string): boolean {
  if (!/^https?:\/\//i.test(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname
      .toLowerCase()
      .replace(/\.+$/, "")
      .replace(/^\[|\]$/g, "");
    return !isBlockedCoverHostname(host);
  } catch {
    return false;
  }
}

function cleanBoundedString(val: unknown, max: number): string {
  return typeof val === "string" ? val.trim().slice(0, max) : "";
}

function cleanOptionalCreator(val: unknown): string | undefined {
  const cleaned = cleanBoundedString(val, MAX_CREATOR_CHARS);
  return cleaned || undefined;
}

function cleanOptionalCoverUrl(val: unknown): string | undefined {
  const cleaned = cleanBoundedString(val, MAX_COVER_URL_CHARS);
  return cleaned && isSafeCoverUrl(cleaned) ? cleaned : undefined;
}

function cleanOptionalMetadata(val: unknown): Record<string, unknown> | undefined {
  return val !== null && typeof val === "object" && !Array.isArray(val)
    ? { ...(val as Record<string, unknown>) }
    : undefined;
}

export function normalizeProviderResult(
  mediaType: MediaType,
  value: unknown,
): NormalizedSearchResult | null {
  if (!MEDIA_TYPES.includes(mediaType) || value === null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const externalSource = cleanBoundedString(record.externalSource, MAX_SOURCE_CHARS).toLowerCase();
  const externalId = cleanBoundedString(record.externalId, MAX_EXTERNAL_ID_CHARS);
  const title =
    typeof record.title === "string"
      ? record.title.replace(/\s+/gu, " ").trim().slice(0, MAX_TITLE_CHARS)
      : "";

  if (!externalSource || !externalId || !title) return null;

  return {
    externalSource,
    externalId,
    title,
    creator: cleanOptionalCreator(record.creator),
    coverUrl: cleanOptionalCoverUrl(record.coverUrl),
    metadata: cleanOptionalMetadata(record.metadata),
  };
}

export function findCanonicalProviderMatch(
  mediaType: MediaType,
  supplied: unknown,
  canonicalResults: unknown[],
): NormalizedSearchResult | null {
  const requested = normalizeProviderResult(mediaType, supplied);
  if (!requested) return null;

  return (
    canonicalResults
      .map((result) => normalizeProviderResult(mediaType, result))
      .find(
        (result) =>
          result !== null &&
          result.externalSource === requested.externalSource &&
          result.externalId === requested.externalId &&
          foldTitle(result.title) === foldTitle(requested.title),
      ) ?? null
  );
}
