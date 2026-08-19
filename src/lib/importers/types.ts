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

export type ImportSource =
  | "goodreads"
  | "letterboxd"
  | "storygraph"
  | "titirek_json"
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

export function normalizeImportItemPayload(item: unknown): NormalizedImportItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const raw = item as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 300) : "";
  const mediaType = raw.mediaType;
  const status = raw.status;
  if (
    !title ||
    typeof mediaType !== "string" ||
    !Object.values(MediaTypeOptions).includes(mediaType as TitlesMediaTypeOptions) ||
    typeof status !== "string" ||
    !Object.values(ProgressStatusOptions).includes(status as UserMediaProgressStatusOptions)
  ) {
    return null;
  }

  const normalized: NormalizedImportItem = {
    title,
    mediaType: mediaType as TitlesMediaTypeOptions,
    status: status as UserMediaProgressStatusOptions,
  };

  if (typeof raw.creator === "string" && raw.creator.trim()) {
    normalized.creator = raw.creator.trim().slice(0, 300);
  }
  if (typeof raw.coverUrl === "string" && /^https?:\/\//i.test(raw.coverUrl.trim())) {
    normalized.coverUrl = raw.coverUrl.trim().slice(0, 2000);
  }
  if (typeof raw.externalSource === "string" && raw.externalSource.trim()) {
    normalized.externalSource = raw.externalSource.trim().slice(0, 100);
  }
  if (typeof raw.externalId === "string" && raw.externalId.trim()) {
    normalized.externalId = raw.externalId.trim().slice(0, 200);
  }

  if (typeof raw.rating === "number") normalized.rating = raw.rating;
  if (typeof raw.progressCurrent === "number") normalized.progressCurrent = raw.progressCurrent;
  if (typeof raw.progressTotal === "number") normalized.progressTotal = raw.progressTotal;
  if (
    typeof raw.progressUnit === "string" &&
    Object.values(ProgressUnitOptions).includes(raw.progressUnit as UserMediaProgressUnitOptions)
  ) {
    normalized.progressUnit = raw.progressUnit as UserMediaProgressUnitOptions;
  }
  if (typeof raw.currentLabel === "string") normalized.currentLabel = raw.currentLabel;
  if (typeof raw.notes === "string") normalized.notes = raw.notes;
  if (typeof raw.dateAdded === "string") normalized.dateAdded = raw.dateAdded;
  if (typeof raw.dateFinished === "string") normalized.dateFinished = raw.dateFinished;

  return normalized;
}
