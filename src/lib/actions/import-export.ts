"use server";

import { revalidatePath } from "next/cache";
import { toIsoDate } from "@/lib/date";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import type { ActionResult } from "@/types/actions";
import {
  normalizeImportItemPayload,
  type NormalizedImportItem,
} from "@/lib/importers/types";
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
    .replace(/[\u0300-\u036f]/g, "")
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

interface ImportDedupIndex {
  checkAndMark(item: NormalizedImportItem): boolean;
}

function buildImportDedupIndex(existingRecords: UserMediaProgressResponse[]): ImportDedupIndex {
  const externalKeySet = new Set<string>();
  const titleKeySet = new Set<string>();
  const noCreatorTitleKeySet = new Set<string>();
  const seenBatchKeys = new Set<string>();

  for (const rec of existingRecords) {
    if (rec.externalSource && rec.externalId) {
      externalKeySet.add(`${rec.externalSource}:${rec.externalId}`);
    }
    const normTitle = normalizeTitleKey(rec.title);
    const normCreator = rec.creator ? normalizeTitleKey(rec.creator) : "";
    titleKeySet.add(`${rec.mediaType}:${normTitle}:${normCreator}`);
    titleKeySet.add(`${rec.mediaType}:${normTitle}`);
    if (!normCreator) {
      noCreatorTitleKeySet.add(`${rec.mediaType}:${normTitle}`);
    }
  }

  function isExternalDuplicate(item: NormalizedImportItem): boolean {
    if (!item.externalSource || !item.externalId) return false;
    const extKey = `${item.externalSource}:${item.externalId}`;
    if (externalKeySet.has(extKey) || seenBatchKeys.has(extKey)) return true;
    seenBatchKeys.add(extKey);
    return false;
  }

  return {
    checkAndMark(item: NormalizedImportItem): boolean {
      if (isExternalDuplicate(item)) return true;

      const normTitle = normalizeTitleKey(item.title);
      const normCreator = item.creator ? normalizeTitleKey(item.creator) : "";
      const fullTitleKey = `${item.mediaType}:${normTitle}:${normCreator}`;
      const shortTitleKey = `${item.mediaType}:${normTitle}`;

      if (
        titleKeySet.has(fullTitleKey) ||
        (normCreator === "" && titleKeySet.has(shortTitleKey)) ||
        noCreatorTitleKeySet.has(shortTitleKey) ||
        seenBatchKeys.has(fullTitleKey)
      ) {
        return true;
      }

      seenBatchKeys.add(fullTitleKey);
      if (!normCreator) {
        noCreatorTitleKeySet.add(shortTitleKey);
      }
      return false;
    },
  };
}

function neutralizeFreeText(val: string | undefined, max: number): string | null {
  return val ? neutralizeFormulaPrefix(val.trim()).slice(0, max) : null;
}

function resolveImportTimestamp(
  rawDate: string | undefined,
  status: string,
  targetStatus: string,
): string | null {
  return toIsoDate(rawDate) || (status === targetStatus ? new Date().toISOString() : null);
}

function toProgressCreateRecord(
  userId: string,
  item: NormalizedImportItem,
): Record<string, unknown> {
  // Formula-leading bytes are neutralized at the import boundary for the
  // free-text fields only: notes/currentLabel are the realistic carrier
  // for CSV-injection payloads, while title/creator keep display fidelity
  // and machine identifiers (e.g. Goodreads "=0441478123" ISBNs) stay
  // untouched. escapeCsvField neutralizes every field at export time, so
  // anything stored verbatim is still safe when written to a spreadsheet.
  return {
    user: userId,
    mediaType: item.mediaType,
    title: item.title.slice(0, 300),
    creator: item.creator ?? null,
    coverUrl: item.coverUrl ?? null,
    status: item.status,
    progressCurrent: item.progressCurrent !== undefined ? Math.max(0, item.progressCurrent) : null,
    progressTotal: item.progressTotal !== undefined ? Math.max(1, item.progressTotal) : null,
    progressUnit: item.progressUnit ?? null,
    currentLabel: neutralizeFreeText(item.currentLabel, 100),
    notes: neutralizeFreeText(item.notes, 3000),
    rating: item.rating ?? null,
    isSharedWithCircles: true,
    startedAt: resolveImportTimestamp(item.dateAdded, item.status, "in_progress"),
    completedAt: resolveImportTimestamp(item.dateFinished, item.status, "completed"),
    externalSource: item.externalSource ?? null,
    externalId: item.externalId ?? null,
  };
}

async function createSingleProgressRow(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  record: Record<string, unknown>,
): Promise<"imported" | "skipped" | "failed"> {
  try {
    await pb.collection("user_media_progress").create(record);
    return "imported";
  } catch (err) {
    // Only a genuine uniqueness conflict is a legitimate "skip". Any
    // other datastore failure (busy/locked, schema mismatch,
    // connection drop, over-long notes) must not be reported to the
    // user as a successful duplicate — it is a failed import row.
    if (isValidationNotUnique(err)) return "skipped";
    logDiagnostic(err, { action: "batchImportProgress/create" });
    return "failed";
  }
}

async function insertProgressInChunks(
  pb: Awaited<ReturnType<typeof getSuperuserClient>>,
  toInsert: Array<Record<string, unknown>>,
): Promise<{ importedCount: number; skippedCount: number; writeErrors: number }> {
  let importedCount = 0;
  let skippedCount = 0;
  let writeErrors = 0;
  const CHUNK_SIZE = 25;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const outcomes = await Promise.all(chunk.map((rec) => createSingleProgressRow(pb, rec)));
    for (const outcome of outcomes) {
      if (outcome === "imported") importedCount++;
      else if (outcome === "skipped") skippedCount++;
      else writeErrors++;
    }
  }

  return { importedCount, skippedCount, writeErrors };
}

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
    const existingRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        batch: 500,
        filter: pb.filter("user = {:userId}", { userId: session.id }),
        fields: "id,externalSource,externalId,title,creator,mediaType",
      });

    // 2. Build deduplication lookups and filter incoming payload
    const dedup = buildImportDedupIndex(existingRecords);
    const toInsert: Array<Record<string, unknown>> = [];
    let preflightSkipped = 0;

    for (const rawItem of items) {
      const item = normalizeImportItemPayload(rawItem);
      if (!item || dedup.checkAndMark(item)) {
        preflightSkipped++;
        continue;
      }
      toInsert.push(toProgressCreateRecord(session.id, item));
    }

    // 3. Batch insert in parallel chunks
    const { importedCount, skippedCount: dbSkipped, writeErrors } = await insertProgressInChunks(
      pb,
      toInsert,
    );
    const skippedCount = preflightSkipped + dbSkipped;

    revalidatePath("/shelf");
    revalidatePath("/activity");

    if (writeErrors > 0) {
      const diag = logDiagnostic(
        new Error(`${writeErrors} import row(s) failed to write`),
        { action: "batchImportProgress", writeErrors },
      );
      return {
        success: false,
        error: `Imported ${importedCount}, skipped ${skippedCount}, but ${writeErrors} failed to save. Please retry.`,
        traceId: diag.traceId,
      };
    }

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
    const items = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        batch: 500,
        filter: pb.filter("user = {:userId}", { userId: session.id }),
        sort: "-createdAt",
      });

    if (items.length > MAX_EXPORT_ROWS) {
      return {
        success: false,
        error: `Export limit exceeded: your shelf has ${items.length} items but the maximum export size is ${MAX_EXPORT_ROWS}.`,
      };
    }

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
