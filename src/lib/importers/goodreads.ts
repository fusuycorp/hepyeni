import { getField, parseCsvToTable, parseSafeDate } from "./csv-parser";
import type { NormalizedImportItem } from "./types";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

export function parseGoodreadsCsv(csvContent: string): NormalizedImportItem[] {
  const table = parseCsvToTable(csvContent);
  const items: NormalizedImportItem[] = [];

  for (const row of table.rows) {
    const rawTitle = getField(row, "Title", "title");
    if (!rawTitle) continue;

    const bookId = getField(row, "Book Id", "bookid", "id");
    const author = getField(row, "Author", "author", "Author l-f");
    const additionalAuthors = getField(row, "Additional Authors", "additionalauthors");
    const fullAuthor = [author, additionalAuthors].filter(Boolean).join(", ") || undefined;

    const shelf = (getField(row, "Exclusive Shelf", "exclusiveshelf", "shelf") || "").toLowerCase().trim();
    const dateRead = parseSafeDate(getField(row, "Date Read", "dateread"));
    const dateAdded = parseSafeDate(getField(row, "Date Added", "dateadded"));

    let status: UserMediaProgressStatusOptions = "plan_to_consume";
    if (shelf === "read") {
      status = "completed";
    } else if (shelf === "currently-reading") {
      status = "in_progress";
    } else if (shelf === "to-read") {
      status = "plan_to_consume";
    } else if (dateRead) {
      status = "completed";
    }

    const rawRating = getField(row, "My Rating", "myrating", "rating");
    const numRating = rawRating ? parseInt(rawRating, 10) : 0;
    const rating = numRating >= 1 && numRating <= 5 ? numRating : undefined;

    const rawPages = getField(row, "Number of Pages", "numberofpages", "pages");
    const pages = rawPages ? parseInt(rawPages, 10) : undefined;
    const progressTotal = pages && pages > 0 ? pages : undefined;
    const progressCurrent = status === "completed" && progressTotal ? progressTotal : undefined;

    const privateNotes = getField(row, "Private Notes", "privatenotes");
    const myReview = getField(row, "My Review", "myreview", "review");
    const combinedNotes = [privateNotes, myReview].filter(Boolean).join("\n\n") || undefined;

    items.push({
      title: rawTitle,
      creator: fullAuthor,
      mediaType: "book",
      status,
      rating,
      progressCurrent,
      progressTotal,
      progressUnit: progressTotal ? "pages" : undefined,
      notes: combinedNotes,
      dateAdded,
      dateFinished: dateRead,
      externalSource: "goodreads",
      externalId: bookId,
    });
  }

  return items;
}
