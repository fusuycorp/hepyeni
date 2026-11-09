import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import { parseIntRating, parsePositiveInt, type NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

const GOODREADS_SHELF_STATUS: Record<string, UserMediaProgressStatusOptions> = {
  read: "completed",
  "currently-reading": "in_progress",
  "to-read": "plan_to_consume",
};

function resolveGoodreadsStatus(
  shelf: string,
  dateRead?: string,
): UserMediaProgressStatusOptions {
  return GOODREADS_SHELF_STATUS[shelf] ?? (dateRead ? "completed" : "plan_to_consume");
}

function joinNonEmpty(parts: Array<string | undefined>, sep: string): string | undefined {
  return parts.filter(Boolean).join(sep) || undefined;
}

export function parseGoodreadsCsv(csvContent: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];

  for (const row of table.rows) {
    const rawTitle = getField(row, "Title", "title");
    if (!rawTitle) continue;

    const shelf = (getField(row, "Exclusive Shelf", "exclusiveshelf", "shelf") || "")
      .toLowerCase()
      .trim();
    const dateRead = parseSafeDate(getField(row, "Date Read", "dateread"));
    const status = resolveGoodreadsStatus(shelf, dateRead);
    const progressTotal = parsePositiveInt(getField(row, "Number of Pages", "numberofpages", "pages"));

    items.push({
      title: rawTitle,
      creator: joinNonEmpty(
        [
          getField(row, "Author", "author", "Author l-f"),
          getField(row, "Additional Authors", "additionalauthors"),
        ],
        ", ",
      ),
      mediaType: "book",
      status,
      rating: parseIntRating(getField(row, "My Rating", "myrating", "rating")),
      progressCurrent: status === "completed" ? progressTotal : undefined,
      progressTotal,
      progressUnit: progressTotal ? "pages" : undefined,
      notes: joinNonEmpty(
        [
          getField(row, "Private Notes", "privatenotes"),
          getField(row, "My Review", "myreview", "review"),
        ],
        "\n\n",
      ),
      dateAdded: parseSafeDate(getField(row, "Date Added", "dateadded")),
      dateFinished: dateRead,
      externalSource: "goodreads",
      externalId: getField(row, "Book Id", "bookid", "id"),
    });
  }

  return items;
}
