"use server";

import { revalidatePath } from "next/cache";
import { toIsoDate } from "@/lib/date";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import { normalizeImportItemPayload, type NormalizedImportItem } from "@/lib/importers/types";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";
import { exportShelfToJson } from "@/lib/exporters/json-exporter";
import {
  exportShelfToCsv,
  neutralizeFormulaPrefix,
} from "@/lib/exporters/csv-exporter";
import { exportShelfToMarkdownZip } from "@/lib/exporters/markdown-exporter";
import { uint8ArrayToBase64 } from "@/lib/exporters/zip";

export interface BatchImportResult {
  importedCount: number;
  skippedCount: number;
}

export interface ExportResult {
  data: string;
  filename: string;
  mimeType: string;
  isBase64?: boolean;
}

function normalizeTitleKey(title: string): string {
  return title
    .normalize("NFD")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// Hard server-side caps at the trust boundary: a fabricated client can post an
// array of any size, so the import/dedup write-amplification and the export
// RSC payload both need an upper bound (perf H3 / P7).
const MAX_IMPORT_ITEMS = 5000;
const MAX_EXPORT_ROWS = 10000;

// ponytail: action error strings and sync memory export <- synchronous memory buffer and English action strings -> map stable error codes to useTranslations and stream large exports via route handler

export async function batchImportProgress(
  items: NormalizedImportItem[],
): Promise<ActionResult<BatchImportResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: "No valid items to import." };
  }

  if (items.length > MAX_IMPORT_ITEMS) {
    return {
      success: false,
      error: `Import limit exceeded: a maximum of ${MAX_IMPORT_ITEMS} items can be imported at once.`,
    };
  }

  try {
    const pb = await getSuperuserClient();

    // 1. Fetch existing progress records for the user (bounded to avoid memory bloat)
    const existingResult = await pb
      .collection("user_media_progress")
      .getList<UserMediaProgressResponse>(1, MAX_IMPORT_ITEMS, {
        filter: pb.filter("user = {:userId}", { userId: session.id }),
        fields: "id,externalSource,externalId,title,creator,mediaType",
      });
    const existingRecords = existingResult.items;

    // 2. Build deduplication lookups
    const externalKeySet = new Set<string>();
    const titleKeySet = new Set<string>();

    for (const rec of existingRecords) {
      if (rec.externalSource && rec.externalId) {
        externalKeySet.add(`${rec.externalSource}:${rec.externalId}`);
      }
      const normTitle = normalizeTitleKey(rec.title);
      const normCreator = rec.creator ? normalizeTitleKey(rec.creator) : "";
      titleKeySet.add(`${rec.mediaType}:${normTitle}:${normCreator}`);
      titleKeySet.add(`${rec.mediaType}:${normTitle}`);
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Filter out invalid items and duplicates in the incoming payload
    const toInsert: Array<Record<string, unknown>> = [];
    const seenBatchKeys = new Set<string>();

    for (const rawItem of items) {
      const item = normalizeImportItemPayload(rawItem);
      if (!item) {
        skippedCount++;
        continue;
      }

      const cleanTitle = item.title;
      if (!cleanTitle) {
        skippedCount++;
        continue;
      }

      // Check external ID duplicate
      if (item.externalSource && item.externalId) {
        const extKey = `${item.externalSource}:${item.externalId}`;
        if (externalKeySet.has(extKey) || seenBatchKeys.has(extKey)) {
          skippedCount++;
          continue;
        }
        seenBatchKeys.add(extKey);
      }

      // Check title duplicate
      const normTitle = normalizeTitleKey(cleanTitle);
      const normCreator = item.creator ? normalizeTitleKey(item.creator) : "";
      const fullTitleKey = `${item.mediaType}:${normTitle}:${normCreator}`;
      const shortTitleKey = `${item.mediaType}:${normTitle}`;

      if (
        titleKeySet.has(fullTitleKey) ||
        (normCreator === "" && titleKeySet.has(shortTitleKey)) ||
        seenBatchKeys.has(fullTitleKey)
      ) {
        skippedCount++;
        continue;
      }

      seenBatchKeys.add(fullTitleKey);

      // Prepare clean record payload
      const startedAt =
        toIsoDate(item.dateAdded) ||
        (item.status === "in_progress" ? new Date().toISOString() : null);
      const completedAt =
        toIsoDate(item.dateFinished) ||
        (item.status === "completed" ? new Date().toISOString() : null);

      const record: Record<string, unknown> = {
        user: session.id,
        mediaType: item.mediaType,
        title: cleanTitle.slice(0, 300),
        creator: item.creator ? item.creator.trim().slice(0, 300) : null,
        coverUrl: item.coverUrl || null,
        status: item.status,
        progressCurrent:
          typeof item.progressCurrent === "number" && !isNaN(item.progressCurrent)
            ? Math.max(0, item.progressCurrent)
            : null,
        progressTotal:
          typeof item.progressTotal === "number" && !isNaN(item.progressTotal)
            ? Math.max(1, item.progressTotal)
            : null,
        progressUnit: item.progressUnit || null,
        // Formula-leading bytes are neutralized at the import boundary for the
        // free-text fields only: notes/currentLabel are the realistic carrier
        // for CSV-injection payloads, while title/creator keep display fidelity
        // and machine identifiers (e.g. Goodreads "=0441478123" ISBNs) stay
        // untouched. escapeCsvField neutralizes every field at export time, so
        // anything stored verbatim is still safe when written to a spreadsheet.
        currentLabel: item.currentLabel
          ? neutralizeFormulaPrefix(item.currentLabel.trim()).slice(0, 100)
          : null,
        notes: item.notes
          ? neutralizeFormulaPrefix(item.notes.trim()).slice(0, 3000)
          : null,
        rating:
          typeof item.rating === "number" && item.rating >= 1 && item.rating <= 5
            ? item.rating
            : null,
        isSharedWithCircles: true,
        startedAt,
        completedAt,
        externalSource: item.externalSource ? item.externalSource.slice(0, 100) : null,
        externalId: item.externalId ? item.externalId.slice(0, 200) : null,
      };

      toInsert.push(record);
    }

    // 3. Batch insert in parallel chunks
    const CHUNK_SIZE = 25;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (record) => {
          try {
            await pb.collection("user_media_progress").create(record);
            importedCount++;
          } catch {
            skippedCount++;
          }
        }),
      );
    }

    revalidatePath("/shelf");
    revalidatePath("/activity");

    return {
      success: true,
      data: {
        importedCount,
        skippedCount,
      },
    };
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "batchImportProgress",
      totalItems: items.length,
    });
    return {
      success: false,
      error: "An error occurred while importing your records.",
      traceId: diag.traceId,
    };
  }
}

export async function exportShelfData(
  format: "json" | "csv" | "markdown",
): Promise<ActionResult<ExportResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const pb = await getSuperuserClient();
    const listResult = await pb
      .collection("user_media_progress")
      .getList<UserMediaProgressResponse>(1, MAX_EXPORT_ROWS + 1, {
        filter: pb.filter("user = {:userId}", { userId: session.id }),
        sort: "-createdAt",
      });

    if (listResult.totalItems > MAX_EXPORT_ROWS) {
      return {
        success: false,
        error: `Export limit exceeded: your shelf has ${listResult.totalItems} items but the maximum export size is ${MAX_EXPORT_ROWS}.`,
      };
    }

    const items = listResult.items;

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const jsonContent = exportShelfToJson(items);
      return {
        success: true,
        data: {
          data: jsonContent,
          filename: `hepyeni-shelf-${dateStr}.json`,
          mimeType: "application/json",
          isBase64: false,
        },
      };
    }

    if (format === "csv") {
      const csvContent = exportShelfToCsv(items);
      return {
        success: true,
        data: {
          data: csvContent,
          filename: `hepyeni-shelf-${dateStr}.csv`,
          mimeType: "text/csv;charset=utf-8",
          isBase64: false,
        },
      };
    }

    if (format === "markdown") {
      const zipBytes = exportShelfToMarkdownZip(items);
      const base64Data = uint8ArrayToBase64(zipBytes);
      return {
        success: true,
        data: {
          data: base64Data,
          filename: `hepyeni-shelf-obsidian-${dateStr}.zip`,
          mimeType: "application/zip",
          isBase64: true,
        },
      };
    }

    return { success: false, error: "Unsupported export format." };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "exportShelfData", format });
    return {
      success: false,
      error: "An error occurred while creating the export.",
      traceId: diag.traceId,
    };
  }
}
