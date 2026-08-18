import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import type { NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

export function parseStoryGraphCsv(csvContent: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];

  for (const row of table.rows) {
    const rawTitle = getField(row, "Title", "title");
    if (!rawTitle) continue;

    const authors = getField(row, "Authors", "Author", "authors", "author");
    const readStatus = (getField(row, "Read Status", "readstatus", "status") || "").toLowerCase().trim();

    let status: UserMediaProgressStatusOptions = "plan_to_consume";
    if (readStatus === "read") {
      status = "completed";
    } else if (readStatus === "currently-reading") {
      status = "in_progress";
    } else if (readStatus === "to-read") {
      status = "plan_to_consume";
    } else if (readStatus === "did-not-finish" || readStatus === "dnf") {
      status = "dropped";
    } else if (readStatus === "on-hold" || readStatus === "paused") {
      status = "on_hold";
    }

    const rawRating = getField(row, "Star Rating", "starrating", "Rating", "rating");
    let rating: number | undefined;
    if (rawRating) {
      const parsed = parseFloat(rawRating);
      if (!isNaN(parsed) && parsed > 0) {
        rating = Math.max(1, Math.min(5, Math.round(parsed)));
      }
    }

    const rawPages = getField(row, "Number of Pages", "numberofpages", "pages");
    const pages = rawPages ? parseInt(rawPages, 10) : undefined;
    const progressTotal = pages && pages > 0 ? pages : undefined;
    const progressCurrent = status === "completed" && progressTotal ? progressTotal : undefined;

    const review = getField(row, "Review", "review");
    const dateAdded = parseSafeDate(getField(row, "Date Added", "dateadded"));
    const lastDateRead = parseSafeDate(
      getField(row, "Last Date Read", "lastdateread", "Dates Read", "datesread"),
    );

    items.push({
      title: rawTitle,
      creator: authors,
      mediaType: "book",
      status,
      rating,
      progressCurrent,
      progressTotal,
      progressUnit: progressTotal ? "pages" : undefined,
      notes: review,
      dateAdded,
      dateFinished: lastDateRead,
      externalSource: "storygraph",
    });
  }

  return items;
}
