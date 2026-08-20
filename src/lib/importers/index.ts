import { getField, normalizeHeaderKey, parseCsvToTable, parseSafeDate } from "./csv-parser";
import { parseGoodreadsCsv } from "./goodreads";
import { parseLetterboxdCsv } from "./letterboxd";
import { parseStoryGraphCsv } from "./storygraph";
import type { ImportSource, NormalizedImportItem, ParseResult } from "./types";
import type {
  TitlesMediaTypeOptions,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";

export * from "./types";
export * from "./csv-parser";
export * from "./goodreads";
export * from "./letterboxd";
export * from "./storygraph";

// ponytail: importer errors are stable, neutral English strings because this
// parsing lib is locale-agnostic (i18n keys must be added to types.ts +
// en.ts + tr.ts in tandem, and no UI layer owns this file). Never surface a
// raw err.message here — it can leak parser internals into the dropzone UI.
// Upgrade path: return stable codes ("IMPORT_EMPTY_FILE", ...) and let the
// import dropzone map them to localized copy via useTranslations().
const IMPORT_EMPTY_FILE = "The selected file is empty or could not be parsed.";
const IMPORT_NO_VALID_RECORDS = "No valid importable records were found in the file.";
const IMPORT_PARSE_FAILED = "The file could not be parsed.";

export function detectImportSource(
  content: string,
  filename?: string,
): { source: ImportSource; parsedTable?: ReturnType<typeof parseCsvToTable> } {
  if (!content || typeof content !== "string") {
    return { source: "generic_csv" };
  }
  const trimmed = content.trim();
  const lowerFilename = (filename || "").toLowerCase();

  // 1. Check for JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) || (parsed && typeof parsed === "object" && "items" in parsed)) {
        return { source: "hepyeni_json" };
      }
    } catch {
      // Not valid JSON, fall through to CSV
    }
  }

  // 2. Parse CSV headers
  const table = parseCsvToTable(content);
  const normHeaders = new Set(table.normalizedHeaders);

  // Goodreads signature
  if (normHeaders.has("bookid") || (normHeaders.has("exclusiveshelf") && normHeaders.has("myrating"))) {
    return { source: "goodreads", parsedTable: table };
  }

  // Letterboxd signature
  if (
    normHeaders.has("letterboxduri") ||
    normHeaders.has("watcheddate") ||
    lowerFilename.includes("letterboxd") ||
    lowerFilename.endsWith("diary.csv") ||
    lowerFilename.endsWith("watchlist.csv") ||
    lowerFilename.endsWith("watched.csv")
  ) {
    return { source: "letterboxd", parsedTable: table };
  }

  // StoryGraph signature
  if (
    normHeaders.has("readstatus") ||
    normHeaders.has("starrating") ||
    normHeaders.has("lastdateread") ||
    lowerFilename.includes("storygraph")
  ) {
    return { source: "storygraph", parsedTable: table };
  }

  return { source: "generic_csv", parsedTable: table };
}

function parseGenericCsv(content: string): NormalizedImportItem[] {
  const table = parseCsvToTable(content);
  const items: NormalizedImportItem[] = [];

  const validMediaTypes = new Set(["book", "movie", "tv", "music", "podcast"]);
  const validStatuses = new Set([
    "in_progress",
    "completed",
    "plan_to_consume",
    "on_hold",
    "dropped",
  ]);
  const validUnits = new Set(["pages", "chapters", "episodes", "percent", "minutes"]);

  for (const row of table.rows) {
    const rawTitle = getField(row, "Title", "Name", "title", "name");
    if (!rawTitle) continue;

    const creator = getField(
      row,
      "Creator",
      "Author",
      "Director",
      "Artist",
      "creator",
      "author",
      "director",
      "artist",
    );

    const rawMediaType = (
      getField(row, "Media Type", "MediaType", "Type", "mediatype", "type") || "book"
    ).toLowerCase();
    const mediaType: TitlesMediaTypeOptions = validMediaTypes.has(rawMediaType)
      ? (rawMediaType as TitlesMediaTypeOptions)
      : "book";

    const rawStatus = (
      getField(row, "Status", "status", "State", "state") || "plan_to_consume"
    ).toLowerCase().replace(/\s+/g, "_");
    const status: UserMediaProgressStatusOptions = validStatuses.has(rawStatus)
      ? (rawStatus as UserMediaProgressStatusOptions)
      : "plan_to_consume";

    const rawRating = getField(row, "Rating", "Score", "rating", "score");
    const numRating = rawRating ? parseInt(rawRating, 10) : 0;
    const rating = !isNaN(numRating) && numRating >= 1 && numRating <= 5 ? numRating : undefined;

    const rawProgressCurrent = getField(
      row,
      "Progress Current",
      "ProgressCurrent",
      "Current",
      "progresscurrent",
    );
    const progressCurrent = rawProgressCurrent ? parseInt(rawProgressCurrent, 10) : undefined;

    const rawProgressTotal = getField(
      row,
      "Progress Total",
      "ProgressTotal",
      "Total",
      "Pages",
      "progresstotal",
    );
    const progressTotal = rawProgressTotal ? parseInt(rawProgressTotal, 10) : undefined;

    const rawUnit = (
      getField(row, "Progress Unit", "ProgressUnit", "Unit", "progressunit", "unit") || ""
    ).toLowerCase();
    const progressUnit: UserMediaProgressUnitOptions | undefined = validUnits.has(rawUnit)
      ? (rawUnit as UserMediaProgressUnitOptions)
      : undefined;

    const notes = getField(row, "Notes", "Review", "Comment", "notes", "review", "comment");
    const dateAdded = parseSafeDate(
      getField(row, "Started At", "Date Added", "Created At", "dateadded", "startedat", "createdat"),
    );
    const dateFinished = parseSafeDate(
      getField(
        row,
        "Completed At",
        "Date Finished",
        "Date Read",
        "datefinished",
        "completedat",
        "dateread",
      ),
    );

    items.push({
      title: rawTitle,
      creator,
      mediaType,
      status,
      rating,
      progressCurrent:
        progressCurrent !== undefined && !isNaN(progressCurrent) && progressCurrent >= 0
          ? progressCurrent
          : undefined,
      progressTotal:
        progressTotal !== undefined && !isNaN(progressTotal) && progressTotal > 0
          ? progressTotal
          : undefined,
      progressUnit,
      notes,
      dateAdded,
      dateFinished,
      externalSource: getField(row, "External Source", "externalsource"),
      externalId: getField(row, "External Id", "externalid"),
    });
  }

  return items;
}

function parseHepYeniJson(content: string): NormalizedImportItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const rawList: Record<string, unknown>[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).items)
    ? ((parsed as Record<string, unknown>).items as Record<string, unknown>[])
    : [];

  const items: NormalizedImportItem[] = [];
  const validMediaTypes = new Set(["book", "movie", "tv", "music", "podcast"]);
  const validStatuses = new Set([
    "in_progress",
    "completed",
    "plan_to_consume",
    "on_hold",
    "dropped",
  ]);
  const validUnits = new Set(["pages", "chapters", "episodes", "percent", "minutes"]);

  for (const raw of rawList) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;

    const mediaType =
      typeof raw.mediaType === "string" && validMediaTypes.has(raw.mediaType)
        ? (raw.mediaType as TitlesMediaTypeOptions)
        : "book";

    const status =
      typeof raw.status === "string" && validStatuses.has(raw.status)
        ? (raw.status as UserMediaProgressStatusOptions)
        : "plan_to_consume";

    const rating =
      typeof raw.rating === "number" && !isNaN(raw.rating) && raw.rating >= 1 && raw.rating <= 5
        ? raw.rating
        : undefined;

    const progressUnit =
      typeof raw.progressUnit === "string" && validUnits.has(raw.progressUnit)
        ? (raw.progressUnit as UserMediaProgressUnitOptions)
        : undefined;

    items.push({
      title,
      creator: typeof raw.creator === "string" ? raw.creator : undefined,
      mediaType,
      status,
      rating,
      progressCurrent:
        typeof raw.progressCurrent === "number" && !isNaN(raw.progressCurrent) && raw.progressCurrent >= 0
          ? raw.progressCurrent
          : undefined,
      progressTotal:
        typeof raw.progressTotal === "number" && !isNaN(raw.progressTotal) && raw.progressTotal > 0
          ? raw.progressTotal
          : undefined,
      progressUnit,
      currentLabel: typeof raw.currentLabel === "string" ? raw.currentLabel : undefined,
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      dateAdded: typeof raw.startedAt === "string" ? raw.startedAt : undefined,
      dateFinished: typeof raw.completedAt === "string" ? raw.completedAt : undefined,
      externalSource: typeof raw.externalSource === "string" ? raw.externalSource : undefined,
      externalId: typeof raw.externalId === "string" ? raw.externalId : undefined,
    });
  }

  return items;
}

export function parseImportFile(content: string, filename?: string): ParseResult {
  const errors: string[] = [];
  if (!content || typeof content !== "string" || !content.trim()) {
    return { source: "generic_csv", items: [], errors: [IMPORT_EMPTY_FILE] };
  }

  try {
    const { source } = detectImportSource(content, filename);

    let items: NormalizedImportItem[] = [];
    switch (source) {
      case "goodreads":
        items = parseGoodreadsCsv(content);
        break;
      case "letterboxd":
        items = parseLetterboxdCsv(content, filename);
        break;
      case "storygraph":
        items = parseStoryGraphCsv(content);
        break;
      case "hepyeni_json":
        items = parseHepYeniJson(content);
        break;
      case "generic_csv":
      default:
        items = parseGenericCsv(content);
        break;
    }

    if (items.length === 0) {
      errors.push(IMPORT_NO_VALID_RECORDS);
    }

    return { source, items, errors };
  } catch (err) {
    // Deliberately discards `err.message` — see the ponytail note above.
    void err;
    return { source: "generic_csv", items: [], errors: [IMPORT_PARSE_FAILED] };
  }
}
