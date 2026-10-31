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

export function isSafeCoverUrl(rawUrl: string): boolean {
  if (!/^https?:\/\//i.test(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname
      .toLowerCase()
      .replace(/\.+$/, "")
      .replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "0.0.0.0" ||
      host === "::" ||
      host === "::1" ||
      host === "0:0:0:0:0:0:0:1" ||
      host.startsWith("::ffff:") ||
      host.startsWith("0:0:0:0:0:ffff:") ||
      /^fe[89ab][0-9a-f]:/.test(host) ||
      /^f[cd][0-9a-f]{2}:/.test(host) ||
      host.startsWith("127.") ||
      host.startsWith("169.254.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeProviderResult(
  mediaType: MediaType,
  value: unknown,
): NormalizedSearchResult | null {
  if (!MEDIA_TYPES.includes(mediaType) || value === null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const externalSource =
    typeof record.externalSource === "string"
      ? record.externalSource.trim().toLowerCase().slice(0, MAX_SOURCE_CHARS)
      : "";
  const externalId =
    typeof record.externalId === "string" ? record.externalId.trim().slice(0, MAX_EXTERNAL_ID_CHARS) : "";
  const title =
    typeof record.title === "string"
      ? record.title.replace(/\s+/gu, " ").trim().slice(0, MAX_TITLE_CHARS)
      : "";

  if (!externalSource || !externalId || !title) return null;

  const creator =
    typeof record.creator === "string" && record.creator.trim()
      ? record.creator.trim().slice(0, MAX_CREATOR_CHARS)
      : undefined;
  const coverUrl =
    typeof record.coverUrl === "string" && isSafeCoverUrl(record.coverUrl.trim())
      ? record.coverUrl.trim().slice(0, MAX_COVER_URL_CHARS)
      : undefined;
  const metadata =
    record.metadata !== null &&
    typeof record.metadata === "object" &&
    !Array.isArray(record.metadata)
      ? { ...(record.metadata as Record<string, unknown>) }
      : undefined;

  return { externalSource, externalId, title, creator, coverUrl, metadata };
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
