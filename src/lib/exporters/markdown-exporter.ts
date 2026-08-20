import { createZipArchive, uint8ArrayToBase64, type ZipFileInput } from "./zip";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function escapeYamlString(val: string): string {
  if (val.includes("\n") || val.includes('"') || val.includes(":") || val.includes("#")) {
    return JSON.stringify(val);
  }
  return `"${val}"`;
}

export function generateItemMarkdown(item: UserMediaProgressResponse): {
  filename: string;
  content: string;
} {
  const safeTitle = sanitizeFilename(item.title) || "untitled";
  const safeCreator = item.creator ? ` - ${sanitizeFilename(item.creator)}` : "";
  const filename = `${safeTitle}${safeCreator}.md`;

  const yamlLines = ["---"];
  yamlLines.push(`title: ${escapeYamlString(item.title)}`);
  if (item.creator) yamlLines.push(`creator: ${escapeYamlString(item.creator)}`);
  yamlLines.push(`media_type: "${item.mediaType}"`);
  yamlLines.push(`status: "${item.status}"`);
  if (item.rating) yamlLines.push(`rating: ${item.rating}`);
  if (item.progressCurrent !== undefined && item.progressCurrent !== null) {
    yamlLines.push(`progress_current: ${item.progressCurrent}`);
  }
  if (item.progressTotal !== undefined && item.progressTotal !== null) {
    yamlLines.push(`progress_total: ${item.progressTotal}`);
  }
  if (item.progressUnit) yamlLines.push(`progress_unit: "${item.progressUnit}"`);
  if (item.currentLabel) yamlLines.push(`current_label: ${escapeYamlString(item.currentLabel)}`);
  if (item.startedAt) yamlLines.push(`started_at: "${item.startedAt}"`);
  if (item.completedAt) yamlLines.push(`completed_at: "${item.completedAt}"`);
  if (item.externalSource) yamlLines.push(`external_source: "${item.externalSource}"`);
  if (item.externalId) yamlLines.push(`external_id: ${escapeYamlString(item.externalId)}`);
  yamlLines.push(`created_at: "${item.createdAt}"`);
  yamlLines.push(`updated_at: "${item.updatedAt}"`);
  yamlLines.push("---");
  yamlLines.push("");

  const bodyLines: string[] = [];
  bodyLines.push(`# ${item.title}`);
  if (item.creator) {
    bodyLines.push(`**Creator:** ${item.creator}  `);
  }
  bodyLines.push(`**Type:** ${item.mediaType}  `);
  bodyLines.push(`**Status:** ${item.status}  `);

  if (item.rating) {
    const stars = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
    bodyLines.push(`**Rating:** ${stars} (${item.rating}/5)  `);
  }

  if (item.progressTotal) {
    bodyLines.push(
      `**Progress:** ${item.progressCurrent ?? 0} / ${item.progressTotal} ${item.progressUnit ?? ""}  `,
    );
  }

  if (item.notes && item.notes.trim()) {
    bodyLines.push("");
    bodyLines.push("## Notes");
    bodyLines.push("");
    bodyLines.push(item.notes.trim());
  }

  bodyLines.push("");

  return {
    filename,
    content: `${yamlLines.join("\n")}\n${bodyLines.join("\n")}`,
  };
}

export function exportShelfToMarkdownZip(items: UserMediaProgressResponse[]): Uint8Array {
  const files: ZipFileInput[] = [];
  const usedFilenames = new Set<string>();

  for (const item of items) {
    const { filename, content } = generateItemMarkdown(item);
    let uniqueName = filename;
    let counter = 1;

    while (usedFilenames.has(uniqueName)) {
      const dotIndex = filename.lastIndexOf(".");
      const base = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
      const ext = dotIndex !== -1 ? filename.slice(dotIndex) : "";
      uniqueName = `${base} (${counter})${ext}`;
      counter++;
    }

    usedFilenames.add(uniqueName);
    files.push({
      name: `HepYeni Shelf/${uniqueName}`,
      content,
    });
  }

  // Also include an index overview note
  const indexLines = [
    "---",
    'title: "HepYeni Shelf Overview"',
    `exported_at: "${new Date().toISOString()}"`,
    `total_items: ${items.length}`,
    "---",
    "",
    "# HepYeni Shelf Overview",
    "",
    `Exported **${items.length}** media items on ${new Date().toLocaleDateString()}.`,
    "",
    "| Title | Creator | Type | Status | Rating | Progress |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
  ];

  for (const item of items) {
    const ratingStr = item.rating ? `${item.rating}/5` : "-";
    const progressStr = item.progressTotal
      ? `${item.progressCurrent ?? 0}/${item.progressTotal} ${item.progressUnit ?? ""}`
      : "-";
    indexLines.push(
      `| [[${sanitizeFilename(item.title)}]] | ${item.creator || "-"} | ${item.mediaType} | ${item.status} | ${ratingStr} | ${progressStr} |`,
    );
  }

  files.push({
    name: "HepYeni Shelf/Index.md",
    content: indexLines.join("\n"),
  });

  return createZipArchive(files);
}

export function exportShelfToSingleMarkdown(items: UserMediaProgressResponse[]): string {
  const parts: string[] = [];
  for (const item of items) {
    parts.push(generateItemMarkdown(item).content);
  }
  return parts.join("\n\n---\n\n");
}
