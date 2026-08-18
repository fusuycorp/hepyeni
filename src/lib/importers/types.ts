import type {
  TitlesMediaTypeOptions,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
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
