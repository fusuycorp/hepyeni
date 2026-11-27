import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import { parseStarRating, type NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

function resolveLetterboxdStatus(
  isWatchlist: boolean,
  rating?: number,
  watchedDate?: string,
): UserMediaProgressStatusOptions {
  if (!isWatchlist || rating !== undefined || watchedDate !== undefined) {
    return "completed";
  }
  return "plan_to_consume";
}

function buildLetterboxdExternalId(rawTitle: string, year?: string, uri?: string): string {
  if (uri) return uri;
  return year ? `${rawTitle} (${year})` : rawTitle;
}

export function parseLetterboxdCsv(csvContent: string, filename?: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];
  const isWatchlist = filename?.toLowerCase().includes("watchlist") ?? false;

  for (const row of table.rows) {
    const rawTitle = getField(row, "Name", "Title", "name", "title");
    if (!rawTitle) continue;

    const year = getField(row, "Year", "year");
    const watchedDate = parseSafeDate(getField(row, "Watched Date", "watcheddate"));
    const entryDate = parseSafeDate(getField(row, "Date", "date"));
    const rating = parseStarRating(getField(row, "Rating", "rating"));
    const status = resolveLetterboxdStatus(isWatchlist, rating, watchedDate);

    items.push({
      title: rawTitle,
      creator: year ? `(${year})` : undefined,
      mediaType: "movie",
      status,
      rating,
      notes: getField(row, "Review", "review"),
      dateAdded: entryDate || watchedDate,
      dateFinished: status === "completed" ? watchedDate || entryDate : undefined,
      externalSource: "letterboxd",
      externalId: buildLetterboxdExternalId(
        rawTitle,
        year,
        getField(row, "Letterboxd URI", "letterboxduri", "uri", "url"),
      ),
    });
  }

  return items;
}
