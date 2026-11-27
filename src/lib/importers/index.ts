import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import { parseGoodreadsCsv } from "./goodreads";
import { parseLetterboxdCsv } from "./letterboxd";
import { parseStoryGraphCsv } from "./storygraph";
import {
  nonNegativeNumber,
  parseIntRating,
  parseMediaTypeOrDefault,
  parseNonNegativeInt,
  parsePositiveInt,
  parseProgressStatusOrDefault,
  parseProgressUnit,
  positiveNumber,
  type ImportSource,
  type NormalizedImportItem,
  type ParseResult,
} from "./types";

export * from "./types";
export * from "./csv-parser";
export * from "./goodreads";
export * from "./letterboxd";
export * from "./storygraph";

// ponytail: neutral English importer error strings <- pure parser library is locale-agnostic and owns no UI layer -> return stable error codes and map via useTranslations in import dropzone
const IMPORT_EMPTY_FILE = "The selected file is empty or could not be parsed.";
const IMPORT_FILE_TOO_LARGE = "The selected file is too large to import.";
const IMPORT_NO_VALID_RECORDS = "No valid importable records were found in the file.";
const IMPORT_PARSE_FAILED = "The file could not be parsed.";

export const MAX_IMPORT_FILE_CHARS = 10 * 1024 * 1024;

function isHepYeniJsonPayload(trimmed: string): boolean {
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) || Boolean(parsed && typeof parsed === "object" && "items" in parsed);
  } catch {
    return false;
  }
}

function isGoodreadsSignature(normHeaders: Set<string>): boolean {
  return normHeaders.has("bookid") || (normHeaders.has("exclusiveshelf") && normHeaders.has("myrating"));
}

function isLetterboxdSignature(normHeaders: Set<string>, lowerFilename: string): boolean {
  if (normHeaders.has("letterboxduri") || normHeaders.has("watcheddate")) return true;
  return (
    lowerFilename.includes("letterboxd") ||
    lowerFilename.endsWith("diary.csv") ||
    lowerFilename.endsWith("watchlist.csv") ||
    lowerFilename.endsWith("watched.csv")
  );
}

function isStoryGraphSignature(normHeaders: Set<string>, lowerFilename: string): boolean {
  return (
    normHeaders.has("readstatus") ||
    normHeaders.has("starrating") ||
    normHeaders.has("lastdateread") ||
    lowerFilename.includes("storygraph")
  );
}

export function detectImportSource(
  content: string,
  filename?: string,
): { source: ImportSource; parsedTable?: ReturnType<typeof parseCsvToTable> } {
  if (!content || typeof content !== "string" || content.length > MAX_IMPORT_FILE_CHARS) {
    return { source: "generic_csv" };
  }
  if (isHepYeniJsonPayload(content.trim())) {
    return { source: "hepyeni_json" };
  }

  const lowerFilename = (filename || "").toLowerCase();
  const table = parseCsvToTable(content);
  const normHeaders = new Set(table.normalizedHeaders);

  if (isGoodreadsSignature(normHeaders)) {
    return { source: "goodreads", parsedTable: table };
  }
  if (isLetterboxdSignature(normHeaders, lowerFilename)) {
    return { source: "letterboxd", parsedTable: table };
  }
  if (isStoryGraphSignature(normHeaders, lowerFilename)) {
    return { source: "storygraph", parsedTable: table };
  }

  return { source: "generic_csv", parsedTable: table };
}

function parseGenericCsvRow(row: Record<string, string>): NormalizedImportItem | null {
  const rawTitle = getField(row, "Title", "Name", "title", "name");
  if (!rawTitle) return null;

  const rawMediaType = (
    getField(row, "Media Type", "MediaType", "Type", "mediatype", "type") || "book"
  ).toLowerCase();
  const rawStatus = (
    getField(row, "Status", "status", "State", "state") || "plan_to_consume"
  )
    .toLowerCase()
    .replace(/\s+/g, "_");
  const rawUnit = (
    getField(row, "Progress Unit", "ProgressUnit", "Unit", "progressunit", "unit") || ""
  ).toLowerCase();

  return {
    title: rawTitle,
    creator: getField(
      row,
      "Creator",
      "Author",
      "Director",
      "Artist",
      "creator",
      "author",
      "director",
      "artist",
    ),
    mediaType: parseMediaTypeOrDefault(rawMediaType),
    status: parseProgressStatusOrDefault(rawStatus),
    rating: parseIntRating(getField(row, "Rating", "Score", "rating", "score")),
    progressCurrent: parseNonNegativeInt(
      getField(row, "Progress Current", "ProgressCurrent", "Current", "progresscurrent"),
    ),
    progressTotal: parsePositiveInt(
      getField(row, "Progress Total", "ProgressTotal", "Total", "Pages", "progresstotal"),
    ),
    progressUnit: parseProgressUnit(rawUnit),
    notes: getField(row, "Notes", "Review", "Comment", "notes", "review", "comment"),
    dateAdded: parseSafeDate(
      getField(row, "Started At", "Date Added", "Created At", "dateadded", "startedat", "createdat"),
    ),
    dateFinished: parseSafeDate(
      getField(
        row,
        "Completed At",
        "Date Finished",
        "Date Read",
        "datefinished",
        "completedat",
        "dateread",
      ),
    ),
    externalSource: getField(row, "External Source", "externalsource"),
    externalId: getField(row, "External Id", "externalid"),
  };
}

function parseGenericCsv(
  content: string,
  parsedTable?: ReturnType<typeof parseCsvToTable>,
): NormalizedImportItem[] {
  const table = parsedTable ?? parseCsvToTable(content);
  const items: NormalizedImportItem[] = [];
  for (const row of table.rows) {
    const parsed = parseGenericCsvRow(row);
    if (parsed) items.push(parsed);
  }
  return items;
}

function extractRawJsonList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const items = (parsed as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

function optionalJsonString(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

function parseHepYeniJsonRecord(raw: unknown): NormalizedImportItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const title = typeof rec.title === "string" ? rec.title.trim() : "";
  if (!title) return null;

  const rating =
    typeof rec.rating === "number" && !isNaN(rec.rating) && rec.rating >= 1 && rec.rating <= 5
      ? rec.rating
      : undefined;

  return {
    title,
    creator: optionalJsonString(rec.creator),
    mediaType: parseMediaTypeOrDefault(rec.mediaType),
    status: parseProgressStatusOrDefault(rec.status),
    rating,
    progressCurrent: nonNegativeNumber(rec.progressCurrent),
    progressTotal: positiveNumber(rec.progressTotal),
    progressUnit: parseProgressUnit(rec.progressUnit),
    currentLabel: optionalJsonString(rec.currentLabel),
    notes: optionalJsonString(rec.notes),
    dateAdded: optionalJsonString(rec.startedAt),
    dateFinished: optionalJsonString(rec.completedAt),
    externalSource: optionalJsonString(rec.externalSource),
    externalId: optionalJsonString(rec.externalId),
  };
}

function parseHepYeniJson(content: string): NormalizedImportItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const items: NormalizedImportItem[] = [];
  for (const raw of extractRawJsonList(parsed)) {
    const item = parseHepYeniJsonRecord(raw);
    if (item) items.push(item);
  }
  return items;
}

function dispatchImportParser(
  source: ImportSource,
  content: string,
  filename?: string,
  parsedTable?: ReturnType<typeof parseCsvToTable>,
): NormalizedImportItem[] {
  if (source === "goodreads") return parseGoodreadsCsv(content);
  if (source === "letterboxd") return parseLetterboxdCsv(content, filename);
  if (source === "storygraph") return parseStoryGraphCsv(content);
  if (source === "hepyeni_json") return parseHepYeniJson(content);
  return parseGenericCsv(content, parsedTable);
}

export function parseImportFile(content: string, filename?: string): ParseResult {
  if (!content || typeof content !== "string" || !content.trim()) {
    return { source: "generic_csv", items: [], errors: [IMPORT_EMPTY_FILE] };
  }
  if (content.length > MAX_IMPORT_FILE_CHARS) {
    return { source: "generic_csv", items: [], errors: [IMPORT_FILE_TOO_LARGE] };
  }

  try {
    const { source, parsedTable } = detectImportSource(content, filename);
    const items = dispatchImportParser(source, content, filename, parsedTable);
    const errors = items.length === 0 ? [IMPORT_NO_VALID_RECORDS] : [];
    return { source, items, errors };
  } catch (err) {
    // Deliberately discards `err.message` — see the ponytail note above.
    void err;
    return { source: "generic_csv", items: [], errors: [IMPORT_PARSE_FAILED] };
  }
}
