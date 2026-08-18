import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import type { NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

export function parseLetterboxdCsv(csvContent: string, filename?: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];
  const isWatchlist = filename?.toLowerCase().includes("watchlist") ?? false;

  for (const row of table.rows) {
    const rawTitle = getField(row, "Name", "Title", "name", "title");
    if (!rawTitle) continue;

    const year = getField(row, "Year", "year");
    const uri = getField(row, "Letterboxd URI", "letterboxduri", "uri", "url");
    const watchedDate = parseSafeDate(getField(row, "Watched Date", "watcheddate"));
    const entryDate = parseSafeDate(getField(row, "Date", "date"));
    const review = getField(row, "Review", "review");

    const rawRating = getField(row, "Rating", "rating");
    let rating: number | undefined;
    if (rawRating) {
      const parsed = parseFloat(rawRating);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
        // Letterboxd uses 0.5-5.0 scale, map to 1-5 integer scale
        rating = Math.max(1, Math.min(5, Math.round(parsed)));
      }
    }

    let status: UserMediaProgressStatusOptions = isWatchlist ? "plan_to_consume" : "completed";
    if (isWatchlist && (rating || watchedDate)) {
      status = "completed";
    }

    const dateFinished = status === "completed" ? (watchedDate || entryDate) : undefined;
    const dateAdded = entryDate || watchedDate;

    const externalId = uri || (year ? `${rawTitle} (${year})` : rawTitle);

    items.push({
      title: rawTitle,
      creator: year ? `(${year})` : undefined,
      mediaType: "movie",
      status,
      rating,
      notes: review,
      dateAdded,
      dateFinished,
      externalSource: "letterboxd",
      externalId,
    });
  }

  return items;
}
