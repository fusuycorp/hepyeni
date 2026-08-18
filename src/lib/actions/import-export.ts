"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type { NormalizedImportItem } from "@/lib/importers/types";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";
import { exportShelfToJson } from "@/lib/exporters/json-exporter";
import { exportShelfToCsv } from "@/lib/exporters/csv-exporter";
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
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function toIsoDate(val?: string | null): string | null {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function batchImportProgress(
  items: NormalizedImportItem[],
): Promise<ActionResult<BatchImportResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: "İçe aktarılacak geçerli öğe bulunamadı." };
  }

  try {
    const pb = await getSuperuserClient();

    // 1. Fetch existing progress records for the user
    const existingRecords = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter: pb.filter("user = {:userId}", { userId: session.id }),
      });

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

    for (const item of items) {
      const cleanTitle = item.title?.trim();
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
        currentLabel: item.currentLabel ? item.currentLabel.trim().slice(0, 100) : null,
        notes: item.notes ? item.notes.trim().slice(0, 3000) : null,
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
      error: "Kayıtlar içe aktarılırken bir hata oluştu.",
      traceId: diag.traceId,
    };
  }
}

export async function exportShelfData(
  format: "json" | "csv" | "markdown",
): Promise<ActionResult<ExportResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Lütfen önce giriş yapın." };
  }

  try {
    const pb = await getSuperuserClient();
    const items = await pb
      .collection("user_media_progress")
      .getFullList<UserMediaProgressResponse>({
        filter: pb.filter("user = {:userId}", { userId: session.id }),
        sort: "-createdAt",
      });

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const jsonContent = exportShelfToJson(items);
      return {
        success: true,
        data: {
          data: jsonContent,
          filename: `titirek-shelf-${dateStr}.json`,
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
          filename: `titirek-shelf-${dateStr}.csv`,
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
          filename: `titirek-shelf-obsidian-${dateStr}.zip`,
          mimeType: "application/zip",
          isBase64: true,
        },
      };
    }

    return { success: false, error: "Desteklenmeyen dışa aktarma biçimi." };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "exportShelfData", format });
    return {
      success: false,
      error: "Dışa aktarma oluşturulurken bir hata oluştu.",
      traceId: diag.traceId,
    };
  }
}
