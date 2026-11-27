import type {
  TitlesMediaTypeOptions,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";
import {
  TitlesMediaTypeOptions as MediaTypeOptions,
  UserMediaProgressStatusOptions as ProgressStatusOptions,
  UserMediaProgressUnitOptions as ProgressUnitOptions,
} from "@/types/pocketbase-types";

import { isSafeCoverUrl as isSafeHttpUrl } from "@/lib/providers/validation";

export type ImportSource =
  | "goodreads"
  | "letterboxd"
  | "storygraph"
  | "hepyeni_json"
  | "generic_csv";

export interface NormalizedImportItem {
  title: string;
  creator?: string;
  mediaType: TitlesMediaTypeOptions;
  status: UserMediaProgressStatusOptions;
  coverUrl?: string;
  rating?: number; // 1-5 integer scale
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: UserMediaProgressUnitOptions;
  currentLabel?: string;
  notes?: string;
  dateAdded?: string; // ISO-8601
  dateFinished?: string; // ISO-8601
  externalSource?: string;
  externalId?: string;
}

export interface ParseResult {
  source: ImportSource;
  items: NormalizedImportItem[];
  errors: string[];
}

export const VALID_MEDIA_TYPES = new Set<string>(Object.values(MediaTypeOptions));
export const VALID_PROGRESS_STATUSES = new Set<string>(Object.values(ProgressStatusOptions));
export const VALID_PROGRESS_UNITS = new Set<string>(Object.values(ProgressUnitOptions));

export function trimMax(val: unknown, max: number): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function clampRating(val: unknown): number | undefined {
  if (typeof val !== "number" || !Number.isFinite(val)) return undefined;
  const rounded = Math.round(val);
  return rounded >= 1 && rounded <= 5 ? rounded : undefined;
}

export function parseStarRating(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0 || parsed > 5) return undefined;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

export function parseIntRating(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : undefined;
}

export function parsePositiveInt(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseNonNegativeInt(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return !isNaN(parsed) && parsed >= 0 ? parsed : undefined;
}

export function nonNegativeNumber(val: unknown): number | undefined {
  return typeof val === "number" && Number.isFinite(val) && val >= 0 ? val : undefined;
}

export function positiveNumber(val: unknown): number | undefined {
  return typeof val === "number" && Number.isFinite(val) && val > 0 ? val : undefined;
}

export function parseMediaTypeOrDefault(raw: unknown): TitlesMediaTypeOptions {
  return typeof raw === "string" && VALID_MEDIA_TYPES.has(raw)
    ? (raw as TitlesMediaTypeOptions)
    : "book";
}

export function parseProgressStatusOrDefault(raw: unknown): UserMediaProgressStatusOptions {
  return typeof raw === "string" && VALID_PROGRESS_STATUSES.has(raw)
    ? (raw as UserMediaProgressStatusOptions)
    : "plan_to_consume";
}

export function parseProgressUnit(raw: unknown): UserMediaProgressUnitOptions | undefined {
  return typeof raw === "string" && VALID_PROGRESS_UNITS.has(raw)
    ? (raw as UserMediaProgressUnitOptions)
    : undefined;
}

function sanitizeSafeCoverUrl(val: unknown): string | undefined {
  const trimmed = trimMax(val, 2000);
  return trimmed && isSafeHttpUrl(trimmed) ? trimmed : undefined;
}

function optionalRawString(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

function isRequiredImportBaseValid(
  title: string | undefined,
  mediaType: unknown,
  status: unknown,
): boolean {
  return Boolean(
    title &&
      typeof mediaType === "string" &&
      VALID_MEDIA_TYPES.has(mediaType) &&
      typeof status === "string" &&
      VALID_PROGRESS_STATUSES.has(status),
  );
}

function assignDefined<T extends object>(target: T, patch: Partial<T>): T {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) {
      (target as Record<string, unknown>)[k] = v;
    }
  }
  return target;
}

export function normalizeImportItemPayload(item: unknown): NormalizedImportItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const raw = item as Record<string, unknown>;
  const title = trimMax(raw.title, 300);
  if (!isRequiredImportBaseValid(title, raw.mediaType, raw.status)) {
    return null;
  }

  return assignDefined<NormalizedImportItem>(
    {
      title: title as string,
      mediaType: raw.mediaType as TitlesMediaTypeOptions,
      status: raw.status as UserMediaProgressStatusOptions,
    },
    {
      creator: trimMax(raw.creator, 300),
      coverUrl: sanitizeSafeCoverUrl(raw.coverUrl),
      externalSource: trimMax(raw.externalSource, 100),
      externalId: trimMax(raw.externalId, 200),
      rating: clampRating(raw.rating),
      progressCurrent: nonNegativeNumber(raw.progressCurrent),
      progressTotal: positiveNumber(raw.progressTotal),
      progressUnit: parseProgressUnit(raw.progressUnit),
      currentLabel: optionalRawString(raw.currentLabel),
      notes: optionalRawString(raw.notes),
      dateAdded: optionalRawString(raw.dateAdded),
      dateFinished: optionalRawString(raw.dateFinished),
    },
  );
}
