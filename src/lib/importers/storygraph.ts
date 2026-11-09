import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import { parsePositiveInt, parseStarRating, type NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

const STORYGRAPH_STATUS_MAP: Record<string, UserMediaProgressStatusOptions> = {
  read: "completed",
  "currently-reading": "in_progress",
  "to-read": "plan_to_consume",
  "did-not-finish": "dropped",
  dnf: "dropped",
  "on-hold": "on_hold",
  paused: "on_hold",
};

export function parseStoryGraphCsv(csvContent: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];

  for (const row of table.rows) {
    const rawTitle = getField(row, "Title", "title");
    if (!rawTitle) continue;

    const readStatus = (getField(row, "Read Status", "readstatus", "status") || "")
      .toLowerCase()
      .trim();
    const status = STORYGRAPH_STATUS_MAP[readStatus] ?? "plan_to_consume";
    const progressTotal = parsePositiveInt(getField(row, "Number of Pages", "numberofpages", "pages"));

    items.push({
      title: rawTitle,
      creator: getField(row, "Authors", "Author", "authors", "author"),
      mediaType: "book",
      status,
      rating: parseStarRating(getField(row, "Star Rating", "starrating", "Rating", "rating")),
      progressCurrent: status === "completed" ? progressTotal : undefined,
      progressTotal,
      progressUnit: progressTotal ? "pages" : undefined,
      notes: getField(row, "Review", "review"),
      dateAdded: parseSafeDate(getField(row, "Date Added", "dateadded")),
      dateFinished: parseSafeDate(
        getField(row, "Last Date Read", "lastdateread", "Dates Read", "datesread"),
      ),
      externalSource: "storygraph",
    });
  }

  return items;
}
